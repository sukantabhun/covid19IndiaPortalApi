const express = require('express')
const path = require('path')
const {open} = require('sqlite')
const sqlite3 = require('sqlite3')
const bcrypt = require('bcrypt')
const jwt = require('jsonwebtoken')

const dbPath = path.join(__dirname, 'covid19IndiaPortal.db')
const app = express()

app.use(express.json())

let db = null

const stateObjToResponseObj = dbObj => {
  return {
    stateId: dbObj.state_id,
    stateName: dbObj.state_name,
    population: dbObj.population,
  }
}

const districtObjToResponseObj = dbObj => {
  return {
    districtId: dbObj.district_id,
    districtName: dbObj.district_name,
    stateId: dbObj.state_id,
    cases: dbObj.cases,
    cured: dbObj.cured,
    active: dbObj.active,
    deaths: dbObj.deaths,
  }
}
const authenticateToken = (request, response, next) => {
  let jwtToken
  const authHeader = request.headers['authorization']
  if (authHeader !== undefined) {
    jwtToken = authHeader.split(' ')[1]
  }
  if (jwtToken === undefined) {
    response.status(401)
    response.send('Invalid JWT Token')
  } else {
    jwt.verify(jwtToken, 'MY_SECRET_TOKEN', async (error, payload) => {
      if (error) {
        response.status(401)
        response.send('Invalid JWT Token')
      } else {
        next()
      }
    })
  }
}

const initializeDBAndServer = async () => {
  try {
    db = await open({filename: dbPath, driver: sqlite3.Database})
    app.listen(3000, () => {
      console.log('Server Running at http://localhost:3000/')
    })
  } catch (e) {
    console.log(`DB Error: ${e.message}`)
    process.exit(-1)
  }
}
initializeDBAndServer()

//API 1
app.post('/login/', async (request, response) => {
  const {username, password} = request.body
  const selectUserQuery = `SELECT * FROM user WHERE username = '${username}'`
  const dbUser = await db.get(selectUserQuery)
  if (dbUser === undefined) {
    response.status(400)
    response.send('Invalid user')
  } else {
    const isPasswordMatched = await bcrypt.compare(password, dbUser.password)
    if (isPasswordMatched === true) {
      const payload = {
        username: username,
      }
      const jwtToken = jwt.sign(payload, 'MY_SECRET_TOKEN')
      response.send({jwtToken})
    } else {
      response.status(400)
      response.send('Invalid password')
    }
  }
})

//API 2
app.get('/states/', authenticateToken, async (request, response) => {
  const getStatesQuery = `
            SELECT
              *
            FROM
             state
            ORDER BY
             state_id;`
  const statesArray = await db.all(getStatesQuery)
  response.send(statesArray.map(eachstate => stateObjToResponseObj(eachstate)))
})

//API 3
app.get('/states/:stateId/', authenticateToken, async (request, response) => {
  const {stateId} = request.params
  const getStateQuery = `
          SELECT
          *
          FROM
          state
          WHERE
          state_id = ${stateId};
        `
  const state = await db.get(getStateQuery)
  response.send(stateObjToResponseObj(state))
})

//API 4
app.post('/districts/', authenticateToken, async (request, response) => {
  const {districtName, stateId, cases, cured, active, deaths} = request.body

  const createDistrictQuery = `
      INSERT INTO 
        district (district_name, state_id, cases, cured, active, deaths) 
      VALUES 
        (
          '${districtName}', 
          '${stateId}',
          '${cases}', 
          '${cured}',
          '${active}',
          '${deaths}'
        )`
  await db.run(createDistrictQuery)
  response.send(`District Successfully Added`)
})

//API 5
app.get(
  '/districts/:districtId/',
  authenticateToken,
  async (request, response) => {
    const {districtId} = request.params
    const getdistrictQuery = `
          SELECT
          *
          FROM
          district
          WHERE
          district_id = ${districtId};
        `
    const districtdetails = await db.get(getdistrictQuery)
    response.send(districtObjToResponseObj(districtdetails))
  },
)

//API 6
app.delete(
  '/districts/:districtId/',
  authenticateToken,
  async (request, response) => {
    const {districtId} = request.params
    const deleteDistrictQuery = `
          DELETE
          FROM
          district
          WHERE
          district_id = ${districtId};
        `
    await db.run(deleteDistrictQuery)
    response.send('District Removed')
  },
)

//API 7
app.put(
  '/districts/:districtId',
  authenticateToken,
  async (request, response) => {
    const {districtId} = request.params
    const {districtName, stateId, cases, cured, active, deaths} = request.body
    const updateDistrictQuery = `UPDATE district 
      SET district_name = '${districtName}',
      state_id = ${stateId},
      cases = ${cases},
      cured = ${cured},
      active = ${active},
      deaths = ${deaths}
      WHERE district_id == ${districtId};`

    await db.run(updateDistrictQuery)
    response.send('District Details Updated')
  },
)

//API 8
app.get(
  '/states/:stateId/stats/',
  authenticateToken,
  async (request, response) => {
    const {stateId} = request.params
    const statsQuery = `SELECT 
        SUM(cases) AS totalCases,
        SUM(cured) AS totalCured,
        SUM(active) AS totalActive,
        SUM(deaths) AS totalDeaths
        FROM district
        WHERE state_id = ${stateId}`
    const statsDetails = await db.get(statsQuery)
    console.log(statsDetails)
    const stats = {
      totalCases: statsDetails.totalCases,
      totalCured: statsDetails.totalCured,
      totalActive: statsDetails.totalActive,
      totalDeaths: statsDetails.totalDeaths,
    }
    response.send(stats)
  },
)

module.exports = app
