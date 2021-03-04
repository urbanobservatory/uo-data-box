export const universalTags = [
  {
    name: 'Entity',
    description:
      'An entity ordinarily describes a spatial location, such as a room in a building, or a pole in the street. In some circumstances, an entity may be a mobile piece of equipment, such as those used for validation, in which case the location will be provided as a timeseries.',
  },
  {
    name: 'Feed',
    description:
      'A feed is a representation of a measurement or parametrisation, usually a metric, for example the observed temperature.',
  },
  {
    name: 'Timeseries',
    description:
      'There may be more than one timeseries associated with a feed, provided for convenience. Ordinarily there will be a plain timeseries, representing raw data from the device. In some cases, there may then be additional timeseries representing converted values (e.g. scaled), corrected, or aggregated temporally.',
  },
]
