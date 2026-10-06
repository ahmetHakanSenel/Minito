/**
 * Every test runs in one fixed time zone, whatever the machine or CI runner is set to.
 *
 * Calendar arithmetic is where "works on my machine" hides: a date bucketed by UTC instead of
 * local time is invisible on a runner in UTC and wrong for everyone east or west of it. Istanbul
 * (UTC+3, no daylight saving) is far enough from UTC that such a bug shows, and steady enough that
 * results never change with the season. It has to be set here, before the workers start: a
 * worker reads the zone once, and changing it from inside a test has no effect.
 */
module.exports = async () => {
  process.env.TZ = 'Europe/Istanbul';
};
