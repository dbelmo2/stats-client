

export const formatDuration = (seconds: number): string => {
  const units = [
    { label: 'day',   value: 86400 },
    { label: 'hour',  value: 3600 },
    { label: 'minute', value: 60 },
    { label: 'second', value: 1 },
  ];

  const result = [];

  for (const { label, value } of units) {
    if (seconds >= value) {
      const amount = Math.floor(seconds / value);
      seconds %= value;
      result.push(`${amount} ${label}${amount !== 1 ? 's' : ''}`);
    }
  }

  return result.length > 0 ? result.join(', ') : '0 seconds';
};


