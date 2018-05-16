const assert = require('chai').assert;
const helper = require('./testHelper');

describe('delayed jobs', function(){

  this.timeout(10000);

  let boss;

  before(function(finished){
    helper.start()
      .then(dabauce => {
        boss = dabauce;
        finished();
      });
  });

  after(function(finished){
    boss.stop().then(() => finished());
  });

  it('should wait before processing a delayed job submission', function(finished) {

    let delaySeconds = 2;

    boss.subscribe('wait', job => {
      let start = new Date(job.data.submitted);
      let end = new Date();

      let elapsedSeconds = Math.floor((end-start)/1000);

      console.log('job '+ job.id + ' received in ' + elapsedSeconds + ' seconds with payload: ' + job.data.message);

      job.done().then(function() {
        assert.isAtLeast(delaySeconds, elapsedSeconds);
        finished();
      });
    });

    boss.publish('wait', {message: 'hold your horses', submitted: Date.now()}, {startIn: delaySeconds})
      .then(function(jobId) {
        console.log('job ' + jobId + ' requested to start in ' + delaySeconds + ' seconds');
      });

  });
});



