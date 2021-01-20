import { Scheduler, Timeout } from "../index";

let scheduler: Scheduler;

beforeEach(() => {
  scheduler = new Scheduler(3);
});

afterEach(() => {
  scheduler.stop();
})

test("Basic sequential call.", async () => {

  const callOrder: any[] = [];
  let promises: Promise<any>[] = [];

  const expectedCallTime1 = Date.now() + 100;
  let p1 = new Promise(resolve => {
    scheduler.add(() => {
      expect(Math.abs(Date.now() - expectedCallTime1) <= 10).toBeTruthy();
      callOrder.push(1);
      resolve(null);
    }, {timeMillis: 100});
  });
  promises.push(p1);

  /*
  * The first callback should run within 110 seconds of creating it.
  * The second callback should run within 120 seconds of creating it.
  * */

  const expectedCallTime2 = Date.now() + 110;
  let p2 = new Promise(resolve => {
    scheduler.add(() => {
      expect(Math.abs(Date.now() - expectedCallTime2) <= 10).toBeTruthy();
      callOrder.push(2);
      resolve(null);
    }, {timeMillis: 110});
  });
  promises.push(p2);

  const expectedCallTime3 = Date.now() + 5;
  let p3 = new Promise(resolve => {
    scheduler.add(() => {
      expect(Math.abs(Date.now() - expectedCallTime3) <= 10).toBeTruthy();
      callOrder.push(3);
      resolve(null);
    }, {timeMillis: 5});
  });
  promises.push(p3);

  await Promise.all(promises);

  expect(callOrder).toEqual([3, 1, 2]); // note

});

describe("Test timeout pause.", () => {

  test("Test timeout pause with pause-adjusted expiration time.", async () => {

    const callOrder: any[] = [];
    let promises: Promise<any>[] = [];

    let t1: Timeout;
    let p1 = new Promise(resolve => {
      t1 = scheduler.add(() => {
        callOrder.push(1);
        resolve(null);
      }, {timeMillis: 1000});
    });
    promises.push(p1);

    let t2: Timeout;
    let p2 = new Promise(resolve => {
      t2 = scheduler.add(() => {
        callOrder.push(2);
        resolve(null);
      }, {timeMillis: 2000});
    });
    promises.push(p2);

    expect(t1.state).toBe("pending");
    expect(t2.state).toBe("pending");

    setTimeout(() => {
      // t1 should have approximately 500ms left
      t1.pause();
      expect(t1.state).toBe("paused");
    }, 500);

    setTimeout(() => {
      // check not called
      expect(callOrder).toEqual([]);
      expect(t1.state).toBe("paused");
      expect(t2.state).toBe("pending");
    }, 1000);

    setTimeout(() => {
      // check t2 called before
      expect(callOrder).toEqual([2]);
      expect(t1.state).toBe("paused");
      expect(t2.state).toBe("complete");

      // resume t1 and check that it resolves in
      t1.resume();

      setTimeout(() => {
        // should now be pending
        expect(callOrder).toEqual([2]);
        expect(t1.state).toBe("pending");
      }, 100);

      setTimeout(() => {
        expect(t1.state).toBe("complete");
        expect(callOrder).toEqual([2, 1]);
      }, 525);

    }, 2200);

    await Promise.all(promises);
  });

  test("Test timeout pause without pause-adjusted expiration time.", async () => {

    const callOrder: any[] = [];
    let promises: Promise<any>[] = [];

    let t1: Timeout;
    let p1 = new Promise(resolve => {
      t1 = scheduler.add(() => {
        callOrder.push(1);
        resolve(null);
      }, {timeMillis: 1000, ignorePauseDelay: true});
    });
    promises.push(p1);

    let t2: Timeout;
    let p2 = new Promise(resolve => {
      t2 = scheduler.add(() => {
        callOrder.push(2);
        resolve(null);
      }, {timeMillis: 2000, ignorePauseDelay: true});
    });
    promises.push(p2);

    expect(t1.state).toBe("pending");
    expect(t2.state).toBe("pending");

    setTimeout(() => {
      // t1 should have approximately 500ms left
      t1.pause();
    }, 500);

    setTimeout(() => {
      // check not called
      expect(callOrder).toEqual([]);
      expect(t1.state).toBe("paused");
      expect(t2.state).toBe("pending");
    }, 1000);

    setTimeout(() => {
      // check t2 called before
      expect(callOrder).toEqual([2]);
      expect(t1.state).toBe("paused");
      expect(t2.state).toBe("complete");
      // resume t1 and check that it resolves in
      t1.resume();

      // should have run as soon as scheduler ran again
      setTimeout(() => {
        expect(t1.state).toBe("complete");
        expect(callOrder).toEqual([2, 1]);
      }, 10);

    }, 2100);

    await Promise.all(promises);

  });

  test("Test pause timeout by key.", async () => {

    const callOrder: any[] = [];
    let promises: Promise<any>[] = [];

    let t1: Timeout;
    let p1 = new Promise(resolve => {
      t1 = scheduler.add(() => {
        callOrder.push(1);
        resolve(null);
      }, {timeMillis: 1000, ignorePauseDelay: true, key: "one"});
    });
    promises.push(p1);

    let t2: Timeout;
    let p2 = new Promise(resolve => {
      t2 = scheduler.add(() => {
        callOrder.push(2);
        resolve(null);
      }, {timeMillis: 2000, bucketKey: "new_buck", key: "two"});
    });
    promises.push(p2);

    expect(t1.state).toBe("pending");
    expect(t2.state).toBe("pending");

    // 500ms
    setTimeout(() => {
      // t1 should have approximately 500ms left
      scheduler.pauseTimeout("one");
      scheduler.pauseTimeout("two", "new_buck");
    }, 500);

    // 1000ms
    setTimeout(() => {
      // check not called
      expect(callOrder).toEqual([]);
      expect(t1.state).toBe("paused");
      expect(t2.state).toBe("paused");
      scheduler.resumeTimeout("two", "new_buck");
      expect(t2.state).toBe("pending");
      // should be about 1500 milliseconds left (15 extra for good measure)
      expect(t2.remainingTime <= 1515).toBeTruthy();
      // even though t1 was paused, it is ignoring the pause delay so the remaining time will be just about expired by now
      expect(t1.remainingTime <= 15).toBeTruthy();
    }, 1000);

    // 2300 ms after start. but t2 should not have run yet, because it was paused 500ms in. meaning this is about 1800ms into t2 schedule
    setTimeout(() => {
      expect(callOrder).toEqual([]);
      expect(t1.state).toBe("paused");
      expect(t2.state).toBe("pending");
    }, 2300);

    // 2600ms after start. t2 should have run as it's 2100ms with resume.
    setTimeout(() => {
      // check t2 called before
      expect(callOrder).toEqual([2]);
      expect(t1.state).toBe("paused");
      expect(t2.state).toBe("complete");
      // resume t1 and check that it resolves immediately as ignorePauseDelay = true
      scheduler.resumeTimeout("one");

      // should have run as soon as scheduler ran again
      setTimeout(() => {
        expect(t1.state).toBe("complete");
        expect(t2.state).toBe("complete");
        expect(callOrder).toEqual([2, 1]);
      }, 10);

    }, 2600);

    await Promise.all(promises);

  });

  test("Test pause timeout, overriding options.ignorePauseDelay.", async () => {
    const callOrder: any[] = [];

    let t1: Timeout;
    let p1 = new Promise(resolve => {
      t1 = scheduler.add(() => {
        callOrder.push(1);
        resolve(null);
      }, {timeMillis: 200, ignorePauseDelay: true, key: "one"})
    });
    let t2: Timeout;
    let p2 = new Promise(resolve => {
      t2 = scheduler.add(() => {
        callOrder.push(2);
        resolve(null);
      }, {timeMillis: 200, ignorePauseDelay: false, key: "two"})
    });

    setTimeout(() => {
      // DO NOT ignore pause delay for t1. i.e., t1 should have 100ms left once it is resumed
      t1.pause(false);
      // IGNORE pause delay for t2. i.e., t2 should run immediately once it is resumed (b/c 300ms total have elapsed since creation)
      scheduler.pauseTimeout("two", undefined, true);
    }, 100);

    setTimeout(() => {
      scheduler.resumeTimeout("one", Scheduler.DEFAULT_BUCKET_KEY, false);
      t2.resume(true);
    }, 300);

    setTimeout(() => {
      expect(callOrder).toEqual([2]);
    }, 305);

    await Promise.all([p1, p2]);
    expect(callOrder).toEqual([2, 1]);

  });

});

test("Test completed events evicted.", async () => {
  await new Promise(resolve => {
    scheduler.add(() => {
      resolve(null);
    }, {timeMillis: 10})
  })
  expect(scheduler.getDefaultBucketTimeouts().length).toBe(0);
});


// this pauses every timeout and resumes them as expected
test("Test scheduler pause.", async () => {
  let called = false;
  let finalTimeoutCompleted = false;
  let t1: Timeout;
  const p1 = new Promise(resolve => {
    t1 = scheduler.add(() => {
      called = true;
      resolve(null);
    }, 1000);
  });
  expect(t1.state).toBe("pending");
  setTimeout(() => {
    scheduler.pause();
    expect(t1.state).toBe("paused");
  }, 500);
  setTimeout(() => {
    expect(t1.state).toBe("paused");
    scheduler.resume();
    expect(t1.state).toBe("pending");
  }, 1000);
  setTimeout(() => {
    expect(t1.state).toBe("pending");
    finalTimeoutCompleted = true;
  }, 1300);

  await p1;

  expect(called).toBeTruthy();
  expect(finalTimeoutCompleted).toBeTruthy();
  expect(t1.state).toBe("complete")
});

test("Test recurring", async () => {
  let callCount = 0;
  let t1: Timeout;

  const p1 = new Promise(resolve => {
    t1 = scheduler.add(() => {
      callCount++;
      if (callCount == 3) {
        resolve(null);
      }
    }, {timeMillis: 50, recurring: true});
  });

  setTimeout(() => {
    expect(callCount).toBe(1);
  }, 60);

  setTimeout(() => {
    expect(callCount).toBe(2);
  }, 120);

  const p2 = new Promise(resolve => {
    setTimeout(() => {
      expect(callCount).toBe(3);
      t1.cancel();  // should stop and no more calls
      resolve(null);
    }, 180);
  })

  const p3 = new Promise(resolve => {
    setTimeout(() => {
      resolve(null)
    }, 250);
  })

  await Promise.all([p1, p2, p3]);
  expect(callCount).toBe(3);
  expect(scheduler.getDefaultBucketTimeouts().length).toBe(0);
});

test("Test same key", async () => {
  let callOrder: any[] = [];
  let t1: Timeout;

  const promises = [];

  const p1 = new Promise(resolve => {
    const opts = {timeMillis: 500, key: "one", overwriteKey: true};
    t1 = scheduler.add(() => {
      callOrder.push("1");
      // should not be called.
      resolve(null);
    }, opts);
    // before first ends should add this second timeout, overwriting and increasing the timeout by about another 250ms
    setTimeout(() => {
      scheduler.add(() => {
        callOrder.push("2");
        resolve(null);
      }, opts)
    }, 250);
  });
  promises.push(p1);

  const p2 = new Promise(resolve => {
    setTimeout(() => {
      // nothing should have been called until about 750ms have passed
      expect(callOrder.length).toBe(0);
      resolve(null);
    }, 600);
  });
  promises.push(p2);

  await Promise.all(promises);
  expect(callOrder).toEqual(["2"]);
});

test("Test timeout cancellation.", async () => {
  let called = false;
  expect(scheduler.getDefaultBucketTimeouts().length).toBe(0);
  const t1 = scheduler.add(() => {
    called = true;
  }, 500);
  expect(scheduler.getDefaultBucketTimeouts().length).toBe(1);
  setTimeout(() => {
    t1.cancel();
  }, 100);
  await new Promise(resolve => {
    setTimeout(() => {
      resolve(null);
    }, 1000);
  });
  expect(called).toBeFalsy();
  expect(scheduler.getDefaultBucketTimeouts().length).toBe(0);
});

test("Throws errors on bad options.", () => {

  expect(() => {
    scheduler.add(() => {
      // will throw
    }, {} as any)
  }).toThrow();

  expect(() => {
    scheduler.add(() => {
      // will throw
    }, undefined as any)
  }).toThrow();

  expect(() => {
    scheduler.add(() => {
      // will throw
    }, "1" as any)
  }).toThrow();

  expect(() => {
    new Scheduler(null as any);
  }).toThrow();

});

