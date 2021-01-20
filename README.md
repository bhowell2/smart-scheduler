# Smart Scheduler
Provides (easily) pause-able timeouts. This does not create multiple timeouts via `setTimeout`, but creates 
a single timeout and iterates through all submitted Timeouts to check if they have expired and run them. All 
Timeouts will be put into a bucket (`Scheduler.DEFAULT_BUCKET_KEY` if none are provided) so that Timeouts of 
a certain bucket can be treated independently. E.g., the user would like to treat all cache timers the same way 
so they are inserted into the 'cache' bucket.

## Usage
`npm install smart-scheduler`

```javascript
import { Scheduler } from "smart-scheduler";
// or
// const {Scheduler} = require('smart-scheduler');
const s = new Scheduler(10);

// note that this may run about 5ms after it is submitted since the scheduler checks for tasks every 10ms
s.add(() => {
  console.log(this);  // correct, of course, since arrow functions capture this.
  console.log("Done");
}, {timeMillis: 105});

// Be careful with this
s.add(function() {
  console.log(this) // Scheduler {} - note this is the Scheduler. Be sure to handle this case.
}, {timeMillis: 105});
// capture this
const outerThis = this;
s.add(function() {
  console.log(outerThis); // desired this.
}, {timeMillis: 105});
//  or, bind this
s.add(function() {
  console.log(this); // desired this.
}.bind(this), {timeMillis: 105});
```

*The options are well documented in typescript [here](./index.ts).*
