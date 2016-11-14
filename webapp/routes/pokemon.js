const express = require('express'),
      randgen = require('randgen'),
        async = require('async'),
         util = require('../util')

const router = express.Router()

function tryCapture(db, user, pokemon, done) {
  var captured = false
  while ((user.bag.greatball > 0 || user.bag.pokeball > 0) && !captured) {
    if (user.bag.greatball > user.bag.pokeball ||
        (user.bag.greatball > 0 && pokemon.level > 40)) {
      user.bag.greatball--
      captured = randgen.rbernoulli(1 - pokemon.level / 220)
    } else {
      user.bag.pokeball--
      captured = randgen.rbernoulli(1 - pokemon.level / 120)
    }
  }
  if (!captured) {
    db.get('user').update({_id: user._id}, {$set: {bag: user.bag}},
      (err) => {done(err, captured)})
  } else {
    async.parallel([
        callback => db.get('user').update({_id: user._id},
          {$set: {bag: user.bag}, $addToSet: {pokemonIds: pokemon._id}},
          done),
        callback => db.get('pokemon').update({_id: pokemon._id},
          {$set: {ownerId: user._id, loc: user.loc}}, done)
      ],
      (err) => {done(err, captured)})
  }
}

router.param('autoPokemonId', util.autoParamMiddleware('pokemon'))

router.get('/:autoPokemonId', function(req, res, next) {
  res.data = {pokemon: req.pokemon}
  next()
})

router.post('/:autoPokemonId/capture', function(req, res, next) {
  if (req.pokemon.ownerId || req.pokemon.stadiumId) {
    return next(new Error("Can't capture Pokemon already owned"))
  }
  req.db.get('user').findOne({_id: req.body.userId}).then(
      function(user) {
        if (!user) {
          res.status(404)
          return next(new Error("User not found"))
        }
        tryCapture(req.db, user, req.pokemon, function (err, captured) {
          res.data = {captured: captured ? 1 : 0, bag: user.bag}
          next(err)
        })
      }, next)
})

module.exports = router