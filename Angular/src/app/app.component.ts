import { Component, ElementRef, ViewChild, AfterViewInit } from '@angular/core';
import * as tf from '@tensorflow/tfjs';
import * as tf_node from '@tensorflow/tfjs-node';
import { tensor3d } from '@tensorflow/tfjs';
import { Webcam } from './webcam';
import { ControllerDataset } from './controller_dataset';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatSnackBar } from '@angular/material';


@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.scss']
})

export class AppComponent implements AfterViewInit {
  public scrollElement;

  public getLearningRate = 0.0001;
  public getBatchSizeFraction = 0.4;
  public getEpochs = 20;
  public getDenseUnits = 100;

  private webcam: any;
  private truncatedMobileNet: any;
  private layer: any;

  public isLoading = true;

  public totals = [0, 0, 0, 0];
  public CONTROLS = ['up', 'down', 'left', 'right'];

  private addExampleHandler: any;

  private NUM_CLASSES = 4;
  private controllerDataset: any;
  public thumbDisplayed: any = {};

  public trainStatus = 'Train';
  public model: any;

  public CONTROL_CODES = [38, 40, 37, 39];

  public isSelect = '';

  public interval;

  public startClicked: boolean = false;

  patternsCount: number;
  noPatternsMsg: string = '';

  constructor(public snackBar: MatSnackBar) {
  }

  ngAfterViewInit() {
    this.init();
  }

  init = () => {
    this.webcam = new Webcam(document.getElementById('webcam'));
    this.scrollElement = document.getElementById('scroll-content');
    this.controllerDataset = new ControllerDataset(this.NUM_CLASSES);

    try {
      this.webcam.setup();
    } catch (e) { }

    this.loadTruncatedMobileNet().then(res => {
      this.truncatedMobileNet = res;
      tf.tidy(() => this.truncatedMobileNet.predict(this.webcam.capture()));
    });

    setTimeout(() => { this.isLoading = false; });
  }

  // loading pretrained MobileNet into the webpage
  // constructing a new model, which outputs an internal activation from MobileNet
  loadTruncatedMobileNet = () => tf.loadModel('https://storage.googleapis.com/tfjs-models/tfjs/mobilenet_v1_0.25_224/model.json')
    .then(res => {
      // reaching in to an internal layer of pretrained MobileNet model and
      // constructing a new model where the inputs are the same outputs of MobileNet 
      this.layer = res.getLayer('conv_pw_13_relu');
      // return a model that outputs an internal activation
      return tf.model({ inputs: res.inputs, outputs: this.layer.output });
    })

  takePhoto = (label: number) => {

    console.log(`Label: ${label}`);

    this.addExampleHandler = label;

    if(this.patternsCount) {
      this.noPatternsMsg = '';
      for (let i = 0; i < this.patternsCount; i++) {

        setTimeout(() => {
          this.totals[label]++;
          tf.nextFrame();
  
          tf.tidy(() => {
            const img = this.webcam.capture();
            this.controllerDataset.addExample(this.truncatedMobileNet.predict(img), label);
  
            this.drawThumb(img, label);
  
          });
        }, i * 1000);
  
      }
    } else {
      this.noPatternsMsg = 'You have to input patterns count!';
    }
    
  }

  drawThumb = (img, label) => {
    if (this.thumbDisplayed[label] == null) {
      const thumbCanvas = document.getElementById(this.CONTROLS[label] + '-thumb');
      this.draw(img, thumbCanvas);
    }
  }

  draw = (image, canvas) => {
    const [width, height] = [224, 224];
    const ctx = canvas.getContext('2d');
    const imageData = new ImageData(width, height);
    const data = image.dataSync();
    for (let i = 0; i < height * width; ++i) {
      const j = i * 4;
      imageData.data[j + 0] = (data[i * 3 + 0] + 1) * 127;
      imageData.data[j + 1] = (data[i * 3 + 1] + 1) * 127;
      imageData.data[j + 2] = (data[i * 3 + 2] + 1) * 127;
      imageData.data[j + 3] = 255;
    }
    ctx.putImageData(imageData, 0, 0);
  }

  train = () => {
    if (this.controllerDataset.xs == null) {
      throw new Error('Add some examples before training!');
    }

    this.model = tf.sequential({
      layers: [
        tf.layers.flatten({
          inputShape: this.truncatedMobileNet.outputs[0].shape.slice(1)
        }),

        tf.layers.dense({
          units: this.getDenseUnits,
          activation: 'relu',
          kernelInitializer: 'varianceScaling',
          useBias: true
        }),

        tf.layers.dense({
          units: this.NUM_CLASSES,
          kernelInitializer: 'varianceScaling',
          useBias: false,
          activation: 'softmax'
        })
      ]
    });

    const optimizer = tf.train.adam(this.getLearningRate);

    this.model.compile({ optimizer: optimizer, loss: 'categoricalCrossentropy' });

    this.saveModelToFile(this.model);

    console.log('Model: ', this.model);

    const batchSize = Math.floor(this.controllerDataset.xs.shape[0] * this.getBatchSizeFraction);

    if (!(batchSize > 0)) {
      throw new Error(
        `Batch size is 0 or NaN. Please choose a non-zero fraction.`);
    }

    this.model.fit(this.controllerDataset.xs, this.controllerDataset.ys, {
      batchSize,
      epochs: this.getEpochs,
      callbacks: {
        onBatchEnd: async (batch, logs) => {
          this.trainStatus = 'Loss: ' + logs.loss.toFixed(5);
        }
      }
    });
  }

  async saveModelToFile(model) {
    // await model.save('/src/model/model.txt');
  }

  trainClick = () => {
    this.trainStatus = 'Training...';

    tf.nextFrame();
    tf.nextFrame();
    this.train();
  }

  predict = () => {
    this.startClicked = true;
    this.interval = setInterval(() => {
      const predictedClass = tf.tidy(() => {
        const img = this.webcam.capture();
        const embeddings = this.truncatedMobileNet.predict(img);
        const predictions = this.model.predict(embeddings);
        return predictions.as1D().argMax();
      });

      predictedClass.data().then(res => {
        const classId = res[0];
        predictedClass.dispose();
        this.predictClass(classId);
      });

      tf.nextFrame();
    }, 300);
  }

  stopPrediction = () => {
    if (this.startClicked) {
      clearInterval(this.interval)
      this.startClicked = false;
    }
  }

  predictClass = (classId) => {
    this.isSelect = `${this.CONTROLS[classId]}-style`;

    if (this.CONTROLS[classId] === 'down') {
      this.scrollElement.scrollTop += 5;
    }

    if (this.CONTROLS[classId] === 'up') {
      this.scrollElement.scrollTop -= 5;
    }
  }

  predictClick = () => {
    this.predict();
  }
}
