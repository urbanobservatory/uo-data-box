#!/bin/bash

cd /usr/src/data/

# Only allow one instance to run at a time
ps x | grep -v $$ | grep 'compress-images' | cut -d ' ' -f1 | xargs kill -9

for DAYS_AGO in 1 2 3 4 5 6 7 8 9 10 11 12 13 14 15 16 17 18 19 20; do
  CHECK_DATE=`date -d "${DAYS_AGO} days ago 13:00" '+%Y%m%d'`
  echo "Checking for uncompressed images from ${CHECK_DATE}..."

  find -type f -name '*'${CHECK_DATE}'_*.jpg' | sed -e 's/^\.\///' | grep -Po "([A-Za-z0-9_]+)_${CHECK_DATE}" | sed -e 's/'_${CHECK_DATE}'//' | sort -n | uniq | while read i;
  do
    echo "Compressing images for ${i} dated ${CHECK_DATE}..."
    zip -9 ${i}_${CHECK_DATE}.zip ${i}_${CHECK_DATE}_*.jpg
    RC=$?
    if [[ "$RC" -eq "0" ]]; then
      rm -rf "${i}_${CHECK_DATE}_"*".jpg"
      echo "Compression complete and files removed."
    else
      if [[ "$RC" -eq "12" ]]; then
        echo "No changes identified. Files can be removed."
        rm -rf "${i}_${CHECK_DATE}_"*".jpg"
      else
        echo "Error during compression ($?)."
      fi
    fi
  done
done
