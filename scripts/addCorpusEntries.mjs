import { readFileSync, writeFileSync } from 'fs'
const appDep = JSON.parse(readFileSync('./src/data/appDepCorpus.json', 'utf8'))
const gnd    = JSON.parse(readFileSync('./src/data/gndCorpus.json', 'utf8'))

const newEntries = [
  // ── TAGALOG CODE-SWITCHING ERRORS ─────────────────────────────────────────
  {
    atc: "PAL181, climb and maintain flight level two eight zero",
    pilot: "Opo, PAL181", isCorrect: false, phase: "climb",
    errorType: "non_english_readback",
    explanation: "Tagalog 'opo' (formal yes) used instead of reading back instruction. Correct: 'Climb and maintain flight level two eight zero, PAL181'"
  },
  {
    atc: "CEB524, descend and maintain eight thousand",
    pilot: "Opo, descend eight thousand, CEB524", isCorrect: false, phase: "descent",
    errorType: "non_english_readback",
    explanation: "Mixed Tagalog 'opo' with partial readback. Correct: 'Descend and maintain eight thousand, CEB524'"
  },
  {
    atc: "PAL102, contact Manila Approach one two four decimal four",
    pilot: "Salamat, one two four decimal four, PAL102", isCorrect: false, phase: "handoff",
    errorType: "social_phrase_in_readback",
    explanation: "Tagalog 'salamat' (thank you) on radio is non-standard. Correct: 'One two four decimal four, PAL102'"
  },
  {
    atc: "AIR101, say again",
    pilot: "Sandali lang, AIR101", isCorrect: false, phase: "general",
    errorType: "non_english_readback",
    explanation: "Tagalog 'sandali lang' (just a moment) not standard. Correct: 'Standby, AIR101'"
  },
  {
    atc: "CEB302, report passing flight level one five zero",
    pilot: "Opo po, CEB302", isCorrect: false, phase: "climb",
    errorType: "non_english_readback",
    explanation: "Double Tagalog politeness 'opo po'. Correct: 'Wilco, CEB302'"
  },
  {
    atc: "PAL888, turn right heading two seven zero",
    pilot: "Nandoon na, heading two seven zero, PAL888", isCorrect: false, phase: "approach",
    errorType: "non_english_readback",
    explanation: "Tagalog 'nandoon na' (we are there now) inserted into readback. Not standard phraseology."
  },
  {
    atc: "CEB777, unable due traffic",
    pilot: "Ah ganoon, CEB777", isCorrect: false, phase: "general",
    errorType: "non_english_readback",
    explanation: "Tagalog 'ganoon' (like that / I see) not standard. Correct: 'Roger, CEB777'"
  },
  {
    atc: "PAL202, check in with Manila Control one three three decimal three",
    pilot: "Oo, one three three decimal three, PAL202", isCorrect: false, phase: "handoff",
    errorType: "non_english_readback",
    explanation: "Tagalog 'oo' (informal yes) not standard on radio. Correct: 'One three three decimal three, PAL202'"
  },
  {
    atc: "PAL191, maayong buntag, cleared ILS approach runway zero four",
    pilot: "Maayong buntag, cleared ILS approach runway zero four, PAL191", isCorrect: false, phase: "approach",
    errorType: "social_phrase_in_readback",
    explanation: "Cebuano greeting 'maayong buntag' (good morning) echoed back. Not standard phraseology."
  },
  // ── GND / TAXI ERROR ENTRIES ──────────────────────────────────────────────
  {
    atc: "PAL101, taxi to runway two four via alpha, bravo, hold short of runway two four",
    pilot: "Taxi runway two four, PAL101", isCorrect: false, phase: "taxi",
    errorType: "incomplete_readback",
    explanation: "Pilot omitted taxi route alpha, bravo and hold-short instruction. Full route and hold-short must be read back per ICAO Doc 4444 Sec 4.7."
  },
  {
    atc: "CEB210, taxi to holding point runway zero four via echo, delta",
    pilot: "Roger, CEB210", isCorrect: false, phase: "taxi",
    errorType: "roger_substitution",
    explanation: "'Roger' not acceptable for taxi instructions. Must read back full route: 'Echo, delta, holding point runway zero four, CEB210'"
  },
  {
    atc: "PAL302, hold short of runway zero four",
    pilot: "Holding short runway zero four, PAL302", isCorrect: true, phase: "ground",
    explanation: "Correct explicit readback of hold-short with runway designation."
  },
  {
    atc: "AIR101, cross runway two four, taxi to apron via alpha",
    pilot: "Cross runway two four, alpha to apron, AIR101", isCorrect: true, phase: "taxi",
    explanation: "Correct readback - runway crossing and route confirmed."
  },
  {
    atc: "CEB303, taxi via alpha, hold short runway zero four",
    pilot: "Wilco, CEB303", isCorrect: false, phase: "taxi",
    errorType: "roger_substitution",
    explanation: "'Wilco' without readback of route and hold-short is not acceptable."
  },
  {
    atc: "PAL404, pushback approved, expect runway two four",
    pilot: "Pushback approved, runway two four, PAL404", isCorrect: true, phase: "ground",
    explanation: "Correct pushback readback with runway expectation confirmed."
  },
  {
    atc: "CEB601, line up and wait runway zero four",
    pilot: "Lining up runway zero four, CEB601", isCorrect: true, phase: "ground",
    explanation: "Correct line-up-and-wait readback with runway designation."
  },
  {
    atc: "PAL505, hold short runway two four, traffic on final",
    pilot: "Holding short, PAL505", isCorrect: false, phase: "ground",
    errorType: "missing_element",
    explanation: "Runway designation omitted in hold-short readback. Runway must always be included."
  },
  {
    atc: "CEB808, engine start approved, pushback at your discretion",
    pilot: "Engine start approved, CEB808", isCorrect: false, phase: "ground",
    errorType: "missing_element",
    explanation: "Pushback authority not read back. Both engine start and pushback elements must be confirmed."
  },
  {
    atc: "PAL222, taxi via bravo, echo, cross runway two four, hold short runway zero four",
    pilot: "Bravo, echo, cross runway two four, hold short runway zero four, PAL222", isCorrect: true, phase: "taxi",
    explanation: "Correct complex taxi readback with crossing and hold-short instructions."
  },
  {
    atc: "PAL222, taxi via bravo, echo, cross runway two four, hold short runway zero four",
    pilot: "Bravo, echo, runway zero four, PAL222", isCorrect: false, phase: "taxi",
    errorType: "missing_element",
    explanation: "Pilot omitted 'cross runway two four' clearance and 'hold short' from readback."
  },
  {
    atc: "PAL999, vacate at delta, contact ground",
    pilot: "Vacate delta, CEB999", isCorrect: false, phase: "landing",
    errorType: "callsign_confusion",
    explanation: "Pilot used wrong callsign (CEB999 instead of PAL999) in readback."
  },
  // ── APP/DEP ADDITIONAL ERRORS ─────────────────────────────────────────────
  {
    atc: "PAL181, expect ILS approach runway zero four, report established",
    pilot: "Expect ILS runway zero four, PAL181", isCorrect: false, phase: "approach",
    errorType: "missing_element",
    explanation: "'Report established' instruction omitted from readback. All instructions must be confirmed."
  },
  {
    atc: "CEB524, after departure turn left heading two seven zero, climb to six thousand",
    pilot: "Left two seven zero, six thousand, CEB524", isCorrect: false, phase: "departure",
    errorType: "incomplete_readback",
    explanation: "'After departure' qualifier omitted. Timing of turn must be confirmed."
  },
  {
    atc: "PAL443, reclimb to five thousand",
    pilot: "Reclimb five thousand, PAL443", isCorrect: false, phase: "approach",
    errorType: "non_standard_terminology",
    explanation: "'Reclimb' is non-standard. Standard: 'go around' or 'climb' per ICAO Doc 4444."
  },
  {
    atc: "PAL443, go around, climb to four thousand, turn left heading one eight zero",
    pilot: "Going around, four thousand, left heading one eight zero, PAL443", isCorrect: true, phase: "approach",
    explanation: "Correct go-around readback with altitude and heading confirmed."
  },
  {
    atc: "CEB302, descend to flight level one five zero",
    pilot: "Decent to flight level one five zero, CEB302", isCorrect: false, phase: "descent",
    errorType: "non_standard_terminology",
    explanation: "'Decent' is misspelling/mispronunciation of 'descend'. Non-standard term flagged."
  },
  {
    atc: "PAL181, fly heading two six zero",
    pilot: "Running heading two six zero, PAL181", isCorrect: false, phase: "approach",
    errorType: "non_standard_terminology",
    explanation: "'Running heading' is non-standard. Correct readback: 'Heading two six zero, PAL181'"
  },
  {
    atc: "CEB524, direct contact Manila Radar one two six decimal five",
    pilot: "Direct contact one two six decimal five, CEB524", isCorrect: false, phase: "handoff",
    errorType: "non_standard_terminology",
    explanation: "'Direct contact' is non-standard handoff phrase. Correct: 'Contact Manila Radar one two six decimal five, CEB524'"
  },
  {
    atc: "PAL181, QNH one zero one eight",
    pilot: "Copy Manila QNH one zero one eight, PAL181", isCorrect: false, phase: "approach",
    errorType: "non_standard_terminology",
    explanation: "'Copy Manila QNH' is non-standard readback format. Correct: 'QNH one zero one eight, PAL181'"
  },
  {
    atc: "PAL181, QNH one zero one eight",
    pilot: "QNH one zero one eight, PAL181", isCorrect: true, phase: "approach",
    explanation: "Correct QNH readback - value and callsign confirmed."
  },
  // ── APPROACH CLEARANCE ERRORS ─────────────────────────────────────────────
  {
    atc: "PAL101, cleared ILS approach runway zero four",
    pilot: "Cleared ILS, PAL101", isCorrect: false, phase: "approach",
    errorType: "missing_element",
    explanation: "Runway designation omitted from approach clearance readback. Correct: 'Cleared ILS approach runway zero four, PAL101'"
  },
  {
    atc: "CEB302, cleared visual approach runway two four",
    pilot: "Cleared visual approach runway two four, CEB302", isCorrect: true, phase: "approach",
    explanation: "Correct approach clearance readback with type and runway."
  },
  {
    atc: "AIR101, expect RNAV approach runway zero four, report ready",
    pilot: "Expect RNAV zero four, ready, AIR101", isCorrect: false, phase: "approach",
    errorType: "incomplete_readback",
    explanation: "Abbreviated 'RNAV approach runway zero four' and omitted 'report' qualifier."
  },
  // ── SQUAWK ERRORS ─────────────────────────────────────────────────────────
  {
    atc: "PAL882, squawk two four six one",
    pilot: "Two four one six, PAL882", isCorrect: false, phase: "departure",
    errorType: "transposition",
    explanation: "Squawk digits transposed (2416 vs 2461). Safety-critical - incorrect squawk can cause loss of identification."
  },
  // ── SPEED ERRORS ──────────────────────────────────────────────────────────
  {
    atc: "PAL302, maintain two five zero knots until TARIX",
    pilot: "Two five zero knots until TARIX, PAL302", isCorrect: true, phase: "approach",
    explanation: "Correct speed restriction readback with waypoint limit."
  },
  {
    atc: "CEB443, reduce speed to one eight zero knots",
    pilot: "Speed one eight zero, CEB443", isCorrect: false, phase: "approach",
    errorType: "incomplete_readback",
    explanation: "Unit 'knots' omitted from speed readback. Speed and unit must be confirmed."
  },
  // ── FREQUENCY ERRORS ──────────────────────────────────────────────────────
  {
    atc: "PAL443, contact Cebu Approach one two four decimal seven",
    pilot: "One two four decimal seven, PAL443", isCorrect: false, phase: "handoff",
    errorType: "missing_element",
    explanation: "Facility name 'Cebu Approach' omitted from frequency readback."
  },
  {
    atc: "PAL443, contact Cebu Approach one two four decimal seven",
    pilot: "Cebu Approach one two four decimal seven, PAL443", isCorrect: true, phase: "handoff",
    explanation: "Correct frequency readback with facility name and frequency."
  },
  // ── CALLSIGN CONFUSION ERRORS ─────────────────────────────────────────────
  {
    atc: "PAL123, descend to eight thousand",
    pilot: "Descend to eight thousand, PAL132", isCorrect: false, phase: "descent",
    errorType: "callsign_confusion",
    explanation: "Callsign digits transposed (PAL132 vs PAL123). Callsign accuracy is safety-critical."
  },
  {
    atc: "CEB710, cleared to land runway zero four",
    pilot: "Cleared to land runway zero four, PAL710", isCorrect: false, phase: "landing",
    errorType: "callsign_confusion",
    explanation: "Wrong airline prefix in readback (PAL vs CEB)."
  },
  // ── ALTITUDE ERRORS ───────────────────────────────────────────────────────
  {
    atc: "PAL181, maintain flight level two five zero",
    pilot: "Maintain flight level two three zero, PAL181", isCorrect: false, phase: "cruise",
    errorType: "wrong_value",
    explanation: "Wrong altitude read back (FL230 vs FL250). Safety-critical."
  },
  {
    atc: "CEB524, climb and maintain one four thousand",
    pilot: "Climb and maintain one two thousand, CEB524", isCorrect: false, phase: "climb",
    errorType: "wrong_value",
    explanation: "Wrong altitude read back (12,000 vs 14,000)."
  },
  // ── CONDITIONAL CLEARANCE ERRORS ──────────────────────────────────────────
  {
    atc: "PAL181, after passing TARIX, descend to eight thousand",
    pilot: "Descend eight thousand, PAL181", isCorrect: false, phase: "descent",
    errorType: "condition_omitted",
    explanation: "Conditional qualifier 'after passing TARIX' omitted. Full conditional must be confirmed."
  },
  {
    atc: "CEB302, when ready, climb to flight level two zero zero",
    pilot: "Climb flight level two zero zero when ready, CEB302", isCorrect: true, phase: "climb",
    explanation: "Correct conditional climb readback with trigger condition confirmed."
  },
  // ── CORRECT PHILIPPINE ATC POSITIVE TRAINING ──────────────────────────────
  {
    atc: "PAL181, good morning, radar contact, climb and maintain flight level three five zero",
    pilot: "Climb and maintain flight level three five zero, PAL181", isCorrect: true, phase: "climb",
    explanation: "Correct readback. ATC greeting not echoed back - social phrases not repeated in readback."
  },
  {
    atc: "CEB524, Manila departure, climb via CORVO SID maintain flight level one five zero",
    pilot: "Climb via CORVO SID maintain flight level one five zero, CEB524", isCorrect: true, phase: "departure",
    explanation: "Correct SID readback with procedure name and altitude constraint."
  },
  {
    atc: "AIR555, contact Manila Ground one two one decimal nine, good day",
    pilot: "Manila Ground one two one decimal nine, AIR555", isCorrect: true, phase: "handoff",
    explanation: "Correct frequency readback. 'Good day' from ATC is not echoed back."
  },
  {
    atc: "CEB888, hold short runway two four, number two for departure",
    pilot: "Hold short runway two four, CEB888", isCorrect: true, phase: "ground",
    explanation: "Correct hold-short readback with runway. Traffic sequence info (number two) does not need readback."
  },
  {
    atc: "PAL302, turn right heading zero three zero",
    pilot: "Turn left heading zero three zero, PAL302", isCorrect: false, phase: "departure",
    errorType: "wrong_direction",
    explanation: "Wrong turn direction read back (left vs right). Direction is safety-critical."
  },
]

// Route entries to the right corpus file by phase
const GND_PHASES = new Set(['ground', 'taxi'])
const appDepNew = newEntries.filter(e => !GND_PHASES.has(e.phase))
const gndNew    = newEntries.filter(e => GND_PHASES.has(e.phase))

appDep.corpus.push(...appDepNew)
appDep.metadata.lastUpdated = "2026-02-28"
appDep.metadata.version = "3.0"
writeFileSync('./src/data/appDepCorpus.json', JSON.stringify(appDep, null, 2))

gnd.corpus.push(...gndNew)
gnd.metadata.lastUpdated = "2026-02-28"
gnd.metadata.version = "3.0"
writeFileSync('./src/data/gndCorpus.json', JSON.stringify(gnd, null, 2))

console.log('Added', appDepNew.length, 'entries to appDepCorpus. Total:', appDep.corpus.length)
console.log('  errors:', appDep.corpus.filter(e => e.isCorrect === false).length)
console.log('Added', gndNew.length, 'entries to gndCorpus. Total:', gnd.corpus.length)
console.log('  errors:', gnd.corpus.filter(e => e.isCorrect === false).length)
