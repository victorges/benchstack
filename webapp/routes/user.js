const express = require('express'),
        async = require('async')
const Trainer = require('../seed/gen-trainer').Trainer

const router = express.Router()

function User(workerNum) {
  Trainer.call(this)
  this.joinedOn = Date.now()
  Object.keys(this.bag).forEach(k => this.bag[k] = 0)

  this.workerNum = workerNum
  this.stadiumIds = []
}

const earthRadiusMt = 6378137
function offsetLocation(loc, offset) {
  let newLat = loc.lat + 180 * offset.vert / (Math.PI * earthRadiusMt)
  let latRad = ((loc.lat + newLat) / 2) * Math.PI / 180
  let newLng = loc.lng + 180 * offset.horz / (Math.PI * earthRadiusMt * Math.cos(latRad))

  if (newLng > 180 || newLng < -180) {
    newLng = newLng - Math.sign(newLng) * 360
  }
  if (newLat > 90 || newLat < -90) {
    newLat = Math.sign(newLat) * 180 - newLat
    newLng = newLng - Math.sign(newLng) * 180
  }
  return {lng: newLng, lat: newLat}
}

function offsetDistSq(offset) {
  return offset.horz * offset.horz + offset.vert * offset.vert
}

router.post('/findOrCreate', function(req, res, next) {
  let workerNum = parseInt(req.body.workerNum)
  if (!workerNum) {
    res.status(400)
    return next(new Error("Invalid worker number"))
  }
  req.db.get('user').findOneAndUpdate(
        {workerNum: workerNum},
        {$setOnInsert: new User(workerNum)},
        {upsert: true})
      .then(function(user) {
        res.data = {id: user._id}
        next()
      }, next)
})

router.param('autoUserId', function(req, res, next, userId) {
  req.db.get('user').findOne({_id: userId})
      .then(function(user) {
        if (!user) {
          res.status(404)
          return next(new Error("User not found"))
        }
        req.user = user
        next()
      }, next)
})

router.get('/:autoUserId', function(req, res, next) {
  res.data = {user: req.user}
  next()
})

router.post('/:userId/bag/drop', function(req, res, next) {
  var updateDoc = {}
  let items = req.body.items;
  ['pokeball', 'greatball', 'revive', 'lure']
      .filter(k => k in items && parseInt(items[k]))
      .forEach(k => updateDoc["bag." + k] = -items[k])

  let userCol = req.db.get('user')
  let query = {_id: req.params.userId}
  userCol.update(query, {$inc: updateDoc}, function(err) {
        if (err) return next(err)

        Object.keys(updateDoc).forEach(k => updateDoc[k] = 0)
        userCol.findOneAndUpdate(query, {$max: updateDoc}, 'bag', function(err, user) {
          res.data = {bag: user.bag}
          next(err)
        })
      })
})

router.get('/:autoUserId/pokemons', function(req, res, next) {
  req.db.get('pokemon').find({_id: { $in: req.user.pokemonIds }}, '-_id')
      .then(function(pokemons) {
        res.data = {pokemons: pokemons}
        next()
      }, next)
})

router.post('/:autoUserId/move', function(req, res, next) {
  let offset = req.body.offset
  if (offsetDistSq(offset) > 25e8) { // at most 50km at a time
    res.status(400)
    return next(new Error("Cannot move more than 5km at a time"))
  }
  let newLoc = offsetLocation(req.user.loc, offset)
  let updateDoc = {$set: {loc: newLoc}}
  async.parallel([
    done => req.db.get('user')
        .update({_id: req.user._id}, updateDoc, done),
    done => req.db.get('pokemon')
        .update({_id: { $in: req.user.pokemonIds }}, updateDoc, {multi: true}, done),
    done => req.db.get('stadium')
        .update({_id: { $in: req.user.stadiumIds }}, updateDoc, {multi: true}, done)
  ], function(err) {
    res.data = {loc: newLoc};
    next(err);
  })
})

module.exports = router