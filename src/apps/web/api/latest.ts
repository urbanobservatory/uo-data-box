import {Data} from 'shared/types/data';
import {events} from 'shared/services/events';

export function initialiseUpdaters() {
  let updateLatestTimer: any = setTimeout(() => updateLatest(), 5000);
  const updateFrequency = 5.0 * 1000;
  async function updateLatest() {
    if (!updateLatestTimer) return;
    updateLatestTimer = null;

    await Promise.all(Object.values(Data).map(async (DataDriver: any) => {
      await DataDriver.queryAllMostRecent();
    }));

    const nextUpdate = Math.ceil(
      Math.ceil(Date.now() / updateFrequency) *
      updateFrequency - Date.now()
    );

    updateLatestTimer = setTimeout(() => updateLatest(), nextUpdate);
  }

  events.on('app:end:*', () => {
    if (updateLatestTimer) {
      clearTimeout(updateLatestTimer);
      updateLatestTimer = null;
    }
  });
}
