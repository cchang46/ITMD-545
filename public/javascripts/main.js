'use strict';

const $self = {
    rtcConfig: null,
    constraints: { audio: false, video:true }

};

const $peer = {

    connection: new RTCPeerConnection($self.rtcConfig)

};

requestUserMedia($self.constraints);

async function requestUserMedia(constraints) {
   const video = document.querySelector('#self');
   $self.stream = await navigator.mediaDevices.getUserMedia(constraints);
   video.srcObject =  $self.stream;
}

/**
* Socket Server Events and Callbacks
*/
const namespace = window.location.hash.substr(1);

const sc = io(`/${namespace}`, { autoConnect: false});

registerScEvents();

/* DOM Events */

const button = document.querySelector('#call-button');

button.addEventListener('click', function() {
  sc.open();
});

/* Signaling Channel Events*/

/* Signaling Channel Events */

function registerScEvents() {
  sc.on('connect', handleScConnect);
  sc.on('connected peer', handleScConnectedPeer);
  sc.on('signal', handleScSignal);
  sc.on('disconnected peer', handleScDisconnectedPeer)
}


function handleScConnect() {
  console.log('Connected to signaling channel!');
}
function handleScConnectedPeer() {
  console.log('Heard connected peer event!');
}
function handleScDisconnectedPeer() {
  console.log('Heard disconnected peer event!');
}
async function handleScSignal() {
  console.log('Heard signal event!');
}
