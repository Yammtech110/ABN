/**
 * Major US cities keyed by two-letter state / DC postal code.
 * Used so registration city dropdown only shows cities for the selected state.
 */
export const US_CITIES_BY_STATE: Record<string, string[]> = {
  AL: ['Birmingham', 'Montgomery', 'Huntsville', 'Mobile', 'Tuscaloosa'],
  AK: ['Anchorage', 'Fairbanks', 'Juneau', 'Wasilla'],
  AZ: ['Phoenix', 'Tucson', 'Mesa', 'Chandler', 'Scottsdale', 'Tempe', 'Glendale'],
  AR: ['Little Rock', 'Fayetteville', 'Fort Smith', 'Springdale'],
  CA: [
    'Los Angeles', 'San Francisco', 'San Diego', 'San Jose', 'Sacramento',
    'Oakland', 'Fresno', 'Long Beach', 'Anaheim', 'Irvine', 'Riverside', 'Bakersfield',
  ],
  CO: ['Denver', 'Colorado Springs', 'Aurora', 'Fort Collins', 'Boulder'],
  CT: ['Bridgeport', 'New Haven', 'Hartford', 'Stamford', 'Waterbury'],
  DE: ['Wilmington', 'Dover', 'Newark'],
  FL: [
    'Miami', 'Orlando', 'Tampa', 'Jacksonville', 'Fort Lauderdale',
    'St. Petersburg', 'Hialeah', 'Tallahassee', 'Hollywood', 'Coral Gables',
  ],
  GA: ['Atlanta', 'Augusta', 'Savannah', 'Columbus', 'Athens', 'Marietta'],
  HI: ['Honolulu', 'Hilo', 'Kailua', 'Kapolei'],
  ID: ['Boise', 'Meridian', 'Nampa', 'Idaho Falls'],
  IL: ['Chicago', 'Aurora', 'Naperville', 'Joliet', 'Rockford', 'Springfield', 'Peoria'],
  IN: ['Indianapolis', 'Fort Wayne', 'Evansville', 'South Bend', 'Carmel'],
  IA: ['Des Moines', 'Cedar Rapids', 'Davenport', 'Iowa City'],
  KS: ['Wichita', 'Overland Park', 'Kansas City', 'Topeka', 'Olathe'],
  KY: ['Louisville', 'Lexington', 'Bowling Green', 'Covington'],
  LA: ['New Orleans', 'Baton Rouge', 'Shreveport', 'Lafayette', 'Metairie'],
  ME: ['Portland', 'Lewiston', 'Bangor', 'South Portland'],
  MD: ['Baltimore', 'Frederick', 'Rockville', 'Gaithersburg', 'Silver Spring'],
  MA: ['Boston', 'Worcester', 'Springfield', 'Cambridge', 'Lowell', 'Quincy'],
  MI: [
    'Detroit', 'Dearborn', 'Grand Rapids', 'Warren', 'Sterling Heights',
    'Ann Arbor', 'Lansing', 'Flint', 'Troy', 'Farmington Hills',
  ],
  MN: ['Minneapolis', 'Saint Paul', 'Rochester', 'Bloomington', 'Duluth'],
  MS: ['Jackson', 'Gulfport', 'Southaven', 'Hattiesburg'],
  MO: ['Kansas City', 'St. Louis', 'Springfield', 'Columbia', 'Independence'],
  MT: ['Billings', 'Missoula', 'Great Falls', 'Bozeman'],
  NE: ['Omaha', 'Lincoln', 'Bellevue', 'Grand Island'],
  NV: ['Las Vegas', 'Henderson', 'Reno', 'North Las Vegas', 'Sparks'],
  NH: ['Manchester', 'Nashua', 'Concord', 'Dover'],
  NJ: [
    'Newark', 'Jersey City', 'Paterson', 'Elizabeth', 'Edison',
    'Woodbridge', 'Lakewood', 'Toms River', 'Hamilton', 'Trenton',
  ],
  NM: ['Albuquerque', 'Las Cruces', 'Rio Rancho', 'Santa Fe'],
  NY: [
    'New York', 'Buffalo', 'Rochester', 'Yonkers', 'Syracuse',
    'Albany', 'New Rochelle', 'Mount Vernon', 'Schenectady', 'Utica',
  ],
  NC: ['Charlotte', 'Raleigh', 'Greensboro', 'Durham', 'Winston-Salem', 'Fayetteville'],
  ND: ['Fargo', 'Bismarck', 'Grand Forks', 'Minot'],
  OH: ['Columbus', 'Cleveland', 'Cincinnati', 'Toledo', 'Akron', 'Dayton'],
  OK: ['Oklahoma City', 'Tulsa', 'Norman', 'Broken Arrow'],
  OR: ['Portland', 'Salem', 'Eugene', 'Gresham', 'Beaverton'],
  PA: [
    'Philadelphia', 'Pittsburgh', 'Allentown', 'Erie', 'Reading',
    'Scranton', 'Bethlehem', 'Lancaster', 'Harrisburg',
  ],
  RI: ['Providence', 'Warwick', 'Cranston', 'Pawtucket'],
  SC: ['Charleston', 'Columbia', 'North Charleston', 'Greenville', 'Myrtle Beach'],
  SD: ['Sioux Falls', 'Rapid City', 'Aberdeen'],
  TN: ['Nashville', 'Memphis', 'Knoxville', 'Chattanooga', 'Clarksville'],
  TX: [
    'Houston', 'Dallas', 'Austin', 'San Antonio', 'Fort Worth',
    'El Paso', 'Arlington', 'Plano', 'Irving', 'Frisco', 'McKinney',
  ],
  UT: ['Salt Lake City', 'West Valley City', 'Provo', 'West Jordan', 'Orem'],
  VT: ['Burlington', 'South Burlington', 'Rutland', 'Essex'],
  VA: [
    'Virginia Beach', 'Norfolk', 'Chesapeake', 'Richmond', 'Newport News',
    'Alexandria', 'Hampton', 'Roanoke', 'Arlington',
  ],
  WA: ['Seattle', 'Spokane', 'Tacoma', 'Vancouver', 'Bellevue', 'Kent', 'Everett'],
  WV: ['Charleston', 'Huntington', 'Morgantown', 'Parkersburg'],
  WI: ['Milwaukee', 'Madison', 'Green Bay', 'Kenosha', 'Racine'],
  WY: ['Cheyenne', 'Casper', 'Laramie', 'Gillette'],
  DC: ['Washington'],
};

/** Cities for a state code; empty if unknown / no state selected. */
export function citiesForState(stateCode: string): string[] {
  const code = String(stateCode || '').trim().toUpperCase();
  if (!code) return [];
  return US_CITIES_BY_STATE[code] ? [...US_CITIES_BY_STATE[code]] : [];
}

/** True if city belongs to the given state (or city list empty / unknown). */
export function cityBelongsToState(city: string, stateCode: string): boolean {
  const list = citiesForState(stateCode);
  if (list.length === 0) return true;
  return list.includes(city);
}
