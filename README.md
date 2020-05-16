# Holomap Proton

Holomap is a real-time collaborative holonic mapping platform.

[this documentation will be updated soon]

## Installation
`./install.sh`

## Dev Server
`./start_dev`

You should see it running at <https://127.0.0.1/>

Front-end files are loaded from pub/index.dev.html, pub/holomap.js and /pub/js 

Note that this server will restart when files are changed.

## Production server
`./start_production`

Front-end files are loaded from pub/index.html and pub/holomap.build.js only.

Note that build.sh will need to be run to create holomap.build.js (based on files in /pub/js used in development).
