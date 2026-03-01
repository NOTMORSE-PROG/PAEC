/**
 * Partition paecCorpus.json into:
 *   paecCorpus.json      — shared master (phraseology, callsigns, waypoints, procedures)
 *   appDepCorpus.json    — APP/DEP corpus entries
 *   gndCorpus.json       — GND corpus entries
 *   rampCorpus.json      — RAMP corpus stub
 */

import { readFileSync, writeFileSync } from 'fs'

const src = JSON.parse(readFileSync('./src/data/paecCorpus.json', 'utf8'))

// ── Phase routing ─────────────────────────────────────────────────────────
// All non-GND phases (including 'general' HuggingFace data) go to APP/DEP
// since they are radar/en-route phraseology.
const GND_PHASES = new Set(['ground', 'taxi'])
const RAMP_PHASES = new Set(['ramp', 'pushback'])

const appDepEntries = []
const gndEntries = []
const rampEntries = []

for (const entry of src.corpus) {
  const phase = (entry.phase || 'general').toLowerCase()
  if (RAMP_PHASES.has(phase)) {
    rampEntries.push(entry)
  } else if (GND_PHASES.has(phase)) {
    gndEntries.push(entry)
  } else {
    appDepEntries.push(entry)
  }
}

// ── 1. paecCorpus.json — shared master (no corpus array) ─────────────────
const shared = {
  metadata: {
    ...src.metadata,
    description: 'PAEC Shared Master — phraseology rules, callsigns, waypoints, procedures. Corpus entries are in appDepCorpus.json / gndCorpus.json / rampCorpus.json',
  },
  phraseology: src.phraseology,
  callsigns:   src.callsigns,
  waypoints:   src.waypoints,
  procedures:  src.procedures,
}
writeFileSync('./src/data/paecCorpus.json', JSON.stringify(shared, null, 2))
console.log('paecCorpus.json (shared) written — NO corpus array')

// ── 2. appDepCorpus.json ──────────────────────────────────────────────────
const appDep = {
  metadata: {
    version: src.metadata.version,
    lastUpdated: src.metadata.lastUpdated,
    description: 'PAEC APP/DEP corpus — Approach/Departure control training pairs. Phases: departure, approach, climb, descent, go_around, landing, takeoff, cruise, enroute, handoff, general.',
  },
  corpus: appDepEntries,
}
writeFileSync('./src/data/appDepCorpus.json', JSON.stringify(appDep, null, 2))
console.log('appDepCorpus.json written —', appDepEntries.length, 'entries')

// ── 3. gndCorpus.json ─────────────────────────────────────────────────────
const gnd = {
  metadata: {
    version: src.metadata.version,
    lastUpdated: src.metadata.lastUpdated,
    description: 'PAEC GND corpus — Ground control training pairs. Phases: ground, taxi.',
  },
  corpus: gndEntries,
}
writeFileSync('./src/data/gndCorpus.json', JSON.stringify(gnd, null, 2))
console.log('gndCorpus.json written —', gndEntries.length, 'entries')

// ── 4. rampCorpus.json — stub ─────────────────────────────────────────────
const ramp = {
  metadata: {
    version: '1.0',
    lastUpdated: src.metadata.lastUpdated,
    description: 'PAEC RAMP corpus — Ramp control training pairs. Phases: ramp, pushback. (stub — to be expanded)',
  },
  corpus: rampEntries,
}
writeFileSync('./src/data/rampCorpus.json', JSON.stringify(ramp, null, 2))
console.log('rampCorpus.json written —', rampEntries.length, 'entries (stub)')

console.log('\nSummary:')
console.log('  shared (paecCorpus.json): no corpus — phraseology/callsigns/waypoints/procedures only')
console.log('  appDepCorpus.json:', appDepEntries.length, 'entries |', appDepEntries.filter(e=>!e.isCorrect).length, 'errors')
console.log('  gndCorpus.json:', gndEntries.length, 'entries |', gndEntries.filter(e=>!e.isCorrect).length, 'errors')
console.log('  rampCorpus.json:', rampEntries.length, 'entries (stub)')
