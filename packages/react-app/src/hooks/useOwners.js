export const useOwners = ({ ownerEvents }) => {
  const events = ownerEvents.sort((a, b) => a.blockNumber - b.blockNumber);
  const { owners, previousOwners } = events.reduce(
    ({ owners, previousOwners }, e) => {
      if (e.added) {
        owners[e.owner] = e;
        delete previousOwners[e.owner];
      } else {
        previousOwners[e.owner] = e;
        delete owners[e.owner];
      }
      return owners;
    },
    { owners: {}, previousOwners: {} },
  );

  return { owners: Object.keys(owners), previousOwners: Object.keys(previousOwners) };
};
