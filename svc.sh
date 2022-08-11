#!/bin/bash

if [ -f ".path" ]; then
    # configure
    export PATH=`cat .path`
    echo ".path=${PATH}"
fi

npm start
