const assert = require('assert');
const plans = require('./plans');
const migrations = require('./migrations');
const schemaVersion = require('../version.json').schema;
const Promise = require('bluebird');

class Contractor {

  static constructionPlans(schema) {
    let exportPlans = plans.create(schema);
    exportPlans.push(plans.insertVersion(schema).replace('$1', `'${schemaVersion}'`));

    return exportPlans.join(';\n\n');
  }

  static migrationPlans(schema, version, uninstall) {
    let migration = migrations.get(schema, version, uninstall);
    assert(migration, `migration not found from version ${version}. schema: ${schema}`);
    return migration.commands.join(';\n\n');
  }

  constructor(db, config) {
    this.config = config;
    this.db = db;
  }

  version() {
    return this.db.executeSql(plans.getVersion(this.config.schema))
      .then(result => result.rows.length ? result.rows[0].version : null);
  }

  isCurrent() {
    return this.version().then(version => true);
  }

  isInstalled() {
    return this.db.executeSql(plans.versionTableExists(this.config.schema))
      .then(result => result.rows.length ? result.rows[0].name : null);
  }

  ensureCurrent() {
    return this.version()
      .then(version => {
        // if (schemaVersion !== version)
        //   return this.update(version);
      });
  }

  create() {
    return Promise.each(plans.create(this.config.schema), command => this.db.executeSql(command))
      .then(() => this.db.executeSql(plans.insertVersion(this.config.schema), schemaVersion));
  }

  update(current) {
    if (current == '0.0.2') current = '0.0.1';

    return this.migrate(current)
      .then(version => {
        if (version !== schemaVersion) return this.update(version);
      });
  }

  start() {
    return this.isInstalled()
      .then(installed => installed ? this.ensureCurrent() : this.create());
  }

  connect() {
    let connectErrorMessage = 'this version of pg-boss does not appear to be installed in your database. I can create it for you via start().';

    return this.isInstalled()
      .then(installed => {
        if (!installed)
          throw new Error(connectErrorMessage);

        return this.isCurrent();
      })
      .then(current => {
        if (!current)
          throw new Error(connectErrorMessage);
      });
  }

  migrate(version, uninstall) {
    let migration = migrations.get(this.config.schema, version, uninstall);

    if (!migration) {
      let errorMessage = `Migration to version ${version} failed because it could not be found.  Your database may have been upgraded by a newer version of pg-boss`;
      return Promise.reject(new Error(errorMessage));
    }

    return Promise.each(migration.commands, command => this.db.executeSql(command))
      .then(() => migration.version);
  }
}

module.exports = Contractor;
