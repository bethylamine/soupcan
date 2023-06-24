const rtf = new Intl.RelativeTimeFormat(navigator.language, { style: 'short' });
const dtf = new Intl.DateTimeFormat(navigator.language);

function timeSince(timestamp) {
  let now = new Date();
  let secondsPast = Math.floor((now.getTime() - timestamp) / 1000);

  if (secondsPast < 60) {
    return rtf.format(-secondsPast, 'second');
  }
  if (secondsPast < 3600) {
    return rtf.format(Math.floor(-secondsPast / 60), 'minute');
  }
  if (secondsPast <= 86400) {
    return rtf.format(Math.floor(-secondsPast / 3600), 'hour');
  }
  if (secondsPast > 86400) {
    return dtf.format(timestamp);
  }
}