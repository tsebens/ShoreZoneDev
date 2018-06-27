/**
 * YouTube utilities
 * NOTE:  This won't work on iOS devices!  See  https://developers.google.com/youtube/iframe_api_reference#Mobile_considerations
 *    "To prevent unsolicited downloads over cellular networks at the user’s expense, embedded media cannot be played automatically in Safari on iOS — the user always initiates playback."
 *    "Due to this restriction, functions and parameters such as autoplay, playVideo(), loadVideoById() won't work in all mobile environments."
 *    [Could I still seekTo, and just use the YT play control?]
 */


var youtube_player = false;
var youtube_timer = false;
var youtube_id = false;
var youtube_player_ready = false;
var youtube_progress_memory = false;
var youtube_playback_memory = 2;
var iOS_playedOnce = false;



function youtube_ready() {
  return youtube_id && youtube_player_ready;
}

function onPlayerReady(event) {
  youtube_player_ready = true;
  youtube_player.mute();
  if (deviceType=="iOS" && !iOS_playedOnce) {
    iOS_playedOnce = true;
    alert("Dear iPad/iPod/iPhone users:  Due to a security restriction in iOS, video playback will not be enabled until you manually touch the red YouTube play icon in the video panel.  Please do so, after closing this dialog.");
  }
  if (youtube_progress_memory) {
    youtube_player.seekTo(youtube_progress_memory, true);
    //youtube_player.playVideo();
  }
}

function onPlayerError(event) {
  alert("YouTube error # " + event.data);
}

function onPlayerStateChange(event) {

  //debug("onPlayerStateChange: " + youtube_player.getPlayerState());


  var state = youtube_player.getPlayerState();

  if (state == 1 && !youtube_timer) {

    if (youtube_progress_memory) {
      szVideoWidget.setPlaybackOn(false);
      szVideoWidget.setVideoPosition(youtube_progress_memory);
      youtube_progress_memory = false;
    }

    if (youtube_playback_memory != 1) {
      szVideoWidget.setPlaybackOn(false);
    }

    youtube_timer = setInterval(CheckVideoProgress, 500/szVideoWidget.playbackRate);

  } else if (state == 0) {      // YT.PlayerState.ENDED
  } else if (state == 2) {      // YT.PlayerState.PAUSED
      //debug("Video paused")
  } else if (state == 3) {      // YT.PlayerState.BUFFERING
      //debug("Video buffering");
  } else if (state == 5) {      // YT.PlayerState.CUED
      //debug("Video cued");
  }

  if (state != 1 && youtube_timer) {
    window.clearInterval(youtube_timer);
    youtube_timer = false;
  }
}

function CheckVideoProgress() {
  var duration = youtube_player.getDuration();
  szVideoWidget.update_track(szVideoWidget.getVideoPosition(), duration);
}

function changePlaybackSpeed(dir) {
  if (!youtube_player)
    return;
  var availRates = youtube_player.getAvailablePlaybackRates();
  var currRate = youtube_player.getPlaybackRate();
  var i = availRates.indexOf(currRate);
  var j = i + dir;
  if (j>=0 && j<availRates.length) {
    szVideoWidget.setPlaybackRate(availRates[j], j==0, j==(availRates.length-1))
  }
}

function onYouTubeIframeAPIReady() {
  // YouTube API calls this function when download of the API is complete
   youtube_player = new YT.Player("videoImageContainer", {
   height: "390",
   width: "640",
   videoId: youtube_id,
   playerVars: {"autoplay": 0, "controls": 0, "rel": 0},
   events: {
     "onReady": onPlayerReady,
     "onError": onPlayerError,
     "onStateChange": onPlayerStateChange
     }
   });
   //debug("YouTube API set up");
}

//*JN*/ debug("Made it through youtube.js");
