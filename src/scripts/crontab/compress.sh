#!/bin/bash

cd /usr/src/data/

MOST_RECENT=`ls -Art ${UO_CRON_PATTERN} | tail -n 1`

for f in ${UO_CRON_PATTERN}; do
  MODIFIED_SINCE=$(($(date +%s) - $(date +%s -r ${f})))
  if [[ ${MODIFIED_SINCE} -gt 900 ]]; then
    if [[ "$MOST_RECENT" = "${f}" ]]; then
      echo "Not compressing ${f}, because it's the latest file."
    else
      echo "Compressing ${f}..."
      zip -9 `basename --suffix=.json ${f}`.zip ${f}
      if [[ "$?" -eq "0" ]]; then
        rm "${f}"
      else
        echo "Error during compression."
      fi
    fi
  fi
done
