import { Component, ElementRef, ViewChild, AfterViewInit } from '@angular/core';
import * as tf from '@tensorflow/tfjs';
import { tensor3d } from '@tensorflow/tfjs';

@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.css']
})


export class AppComponent implements AfterViewInit {

  @ViewChild('videoPlayer') videoplayer: ElementRef;

  numClasses = 4;

  constructor() {
  }

  ngAfterViewInit() {
    navigator.mediaDevices.getUserMedia({ video: true }).then(stream => {
      this.videoplayer.nativeElement.src = window.URL.createObjectURL(stream);
      this.videoplayer.nativeElement.play();
    });
    console.log('DOM created')
    setTimeout(() => {
      this.capture();
      this.loadMobilenet();
    }, 2000);
  }

  capture() {
    let video: HTMLVideoElement = this.videoplayer.nativeElement;
    return tf.tidy(() => {
      const webcamImage = tf.fromPixels(video);
      const croppedImage = this.cropImage(webcamImage);
      const batchedImage = croppedImage.expandDims(0); 
      console.log('batchedImage: ', webcamImage)
    });
  }

  cropImage(img) {
    const size = Math.min(img.shape[0], img.shape[1]);
    const centerHeight = img.shape[0] / 2;
    const beginHeight = centerHeight - (size / 2);
    const centerWidth = img.shape[1] / 2;
    const beginWidth = centerWidth - (size / 2);
    return img.slice([beginHeight, beginWidth, 0], [size, size, 3]);
  }

  async loadMobilenet() {
    const mobilenet = await tf.loadModel('https://storage.googleapis.com/tfjs-models/tfjs/mobilenet_v1_0.25_224/model.json');
    const layer = mobilenet.getLayer('conv_pw_13_relu');
    return tf.model({inputs: mobilenet.inputs, outputs: layer.output});
  }

  addExample(example, label) {
    const y = tf.tidy(() => tf.oneHot(tf.tensor1d([label]), this.numClasses));
  }

}
