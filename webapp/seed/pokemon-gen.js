const pokemon   = require('pokemon'),
      baseStats = require('pokemon-base-stats'),
      statsCalc = require('pokemon-stat-calculator'),
      {rchisq, runif, rlist} = require('randgen')
const natures   = require('./pokemon-natures')

function genArray(size, generator) {
  arr = Array(size)
  for (var i = 0; i < size; i++) {
    arr[i] = generator()
  }
  return arr
}

function limit(v, {min = -Infinity, max = Infinity}) {
  if (v < min) v = min
  if (v > max) v = max
  return Math.trunc(v)
}

function countIf(arr, predicate) {
  let count = 0
  for (let i = 0; i < arr.length; i++) {
    if (predicate(arr[i], i, arr)) count++
  }
  return count
}

function randomIVs() {
  // check http://bulbapedia.bulbagarden.net/wiki/Individual_values#Generation_I_and_II
  let baseIVs = genArray(4, () => limit(rchisq(3) * 2, {max: 15}))
  let hpIV = baseIVs
    .map((v, i) => (v & 1) << i)
    .reduce((a, b) => a | b)
  return [hpIV, baseIVs[0], baseIVs[1], baseIVs[3], baseIVs[3], baseIVs[2]]
}

function randomEVs(level) {
  // check http://bulbapedia.bulbagarden.net/wiki/Effort_values#Stat_experience
  let mult = rchisq() * Math.pow(level, 1.4)
  let EVs = genArray(
      6,
      () => limit(Math.sqrt(rchisq(5) * 25 * mult), {max: 255}))

  let evSum = () => EVs.reduce((a, b) => a + b)
  while (evSum() > 510) {
    diff = (evSum() - 510) / countIf(EVs, v => v > 0)
    EVs = EVs.map(v => limit(v - diff, {min: 0}));
  }
  return EVs;
}

// Exported API

function Pokemon(pkmid, form, nature, level, IVs, EVs) {
  this.pkmid = pkmid
  this.name = pokemon.getName(pkmid)
  this.form = form
  this.nature = nature
  this.level = level

  let base = baseStats.getById({id: pkmid, forme: form})
  let natureVals = natures.values[nature]
  let stats = statsCalc.calAllStats(IVs, base, EVs, level, natureVals)
  this.stats = {
    HP: stats[0],
    Atk: stats[1],
    Def: stats[2],
    SpAtk: stats[3],
    SpDef: stats[4],
    Spd: stats[5]
  }
}

function randomPokemon(level) {
  let id = runif(0, pokemon.all().length, true) + 1
  let form = rlist(baseStats.getFormes({id: id})),
      nature = rlist(natures.names)
  if (level === undefined) {
    level = limit(rchisq(2) * 5, {min: 1, max: 100})
  }
  return new Pokemon(id, form, nature, level, randomIVs(), randomEVs(level))
}

exports.Pokemon = Pokemon
exports.randomPokemon = randomPokemon