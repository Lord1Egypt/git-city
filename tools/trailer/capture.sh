#!/bin/zsh
# Opens a clean browser window for recording a trailer (macOS): its own
# profile (no extensions, no bookmarks bar), app mode (no address bar), sized
# so a 1280×720 page sits inside the title bar and a small margin. Crop the
# recorder's capture to the page: 16 px left and right, 74 px top, 10 px
# bottom at 2× (see tools/trailer/README.md).
#
# Usage: tools/trailer/capture.sh [url]
#   BROWSER="Brave Browser" tools/trailer/capture.sh   (default: Google Chrome)
URL="${1:-http://localhost:3001/trailer/towns}"
BROWSER="${BROWSER:-Google Chrome}"
# Your everyday windows of the same browser end with this in their title; the capture window doesn't.
case "$BROWSER" in
  "Brave Browser") OWN=" - Brave" ;;
  *) OWN=" - $BROWSER" ;;
esac
open -na "$BROWSER" --args \
  --user-data-dir="$HOME/Library/Application Support/GitCityTrailerCapture" \
  --app="$URL" \
  --no-first-run --no-default-browser-check --hide-crash-restore-bubble
sleep 2
# Centre it on the built-in screen (or the main one), in the coordinates System Events uses.
POS=$(osascript -l JavaScript -e 'ObjC.import("AppKit"); var s=$.NSScreen.screens; var main=s.objectAtIndex(0).frame; var r=null; for (var i=0;i<s.count;i++){ if (s.objectAtIndex(i).localizedName.js.indexOf("Built-in")>=0) r=s.objectAtIndex(i).frame; } if(!r) r=main; var x=Math.round(r.origin.x+(r.size.width-1296)/2); var y=Math.round(main.size.height-(r.origin.y+r.size.height))+Math.max(34,Math.round((r.size.height-762)/2)); x+","+y')
X=${POS%,*}; Y=${POS#*,}
# The browser remembers the last window size, so set it: 1296×762 = a 1280×720 page plus title bar and margins.
osascript <<OSA
tell application "System Events"
  repeat with p in (every process whose name is "$BROWSER")
    repeat with w in (every window of p)
      if name of w does not contain "$OWN" then
        set position of w to {$X, $Y}
        set size of w to {1296, 762}
      end if
    end repeat
  end repeat
end tell
OSA
