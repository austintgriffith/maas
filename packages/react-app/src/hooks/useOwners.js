export const useOwners = ({ ownerEvents }) => {
  const events = ownerEvents?.sort((a, b) => a.blockNumber - b.blockNumber) || [];
  const { owners, previousOwners } = events.reduce(
    (result, { args }) => {
      const { owners, previousOwners } = result;
      if (args.added) {
        owners.add(args.owner);
        previousOwners.delete(args.owner);
      } else {
        previousOwners.add(args.owner);
        owners.delete(args.owner);
      }
      return result;
    },
    { owners: new Set(), previousOwners: new Set() },
  );

  return { owners: [...owners], previousOwners: [...previousOwners] };
};
