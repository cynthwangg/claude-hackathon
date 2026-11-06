export type Authority = { id: string; profession: string; state: string; name: string; url: string; source: "table" | "search"; cited?: string };

/** Offices we name without a search. Every URL here is a root page of an official .gov site. */
export const authorities: Authority[] = [
  { id: "ca_ctc", profession: "teacher", state: "CA", name: "Commission on Teacher Credentialing (CTC)", url: "https://www.ctc.ca.gov/", source: "table" },
  { id: "ca_brn", profession: "nurse", state: "CA", name: "California Board of Registered Nursing", url: "https://www.rn.ca.gov/", source: "table" },
  { id: "ca_bpelsg", profession: "engineer", state: "CA", name: "Board for Professional Engineers, Land Surveyors, and Geologists", url: "https://www.bpelsg.ca.gov/", source: "table" },
  { id: "ca_cab", profession: "architect", state: "CA", name: "California Architects Board", url: "https://www.cab.ca.gov/", source: "table" },
  { id: "tx_bon", profession: "nurse", state: "TX", name: "Texas Board of Nursing", url: "https://www.bon.texas.gov/", source: "table" },
  { id: "tx_tea", profession: "teacher", state: "TX", name: "Texas Education Agency, Educator Certification", url: "https://tea.texas.gov/", source: "table" },
  { id: "ny_nysed_teach", profession: "teacher", state: "NY", name: "New York State Education Department, Office of Teaching Initiatives", url: "https://www.highered.nysed.gov/tcert/", source: "table" },
  { id: "ny_nysed_op", profession: "nurse", state: "NY", name: "New York State Education Department, Office of the Professions", url: "https://www.op.nysed.gov/", source: "table" },
];

export const findAuthority = (profession: string | null, state: string | null) =>
  profession && state ? authorities.find((a) => a.profession === profession && a.state === state) ?? null : null;
