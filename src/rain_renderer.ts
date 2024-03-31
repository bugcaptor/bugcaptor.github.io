import { RendererInterface } from './renderer';
import { clampValue, createShader, degreesToRadians, rangedRandom } from './utility';
import { mat4, vec3 } from 'gl-matrix';

interface Raindrop {
	position: vec3;
	tailLength: number;
	speedRatio: number;
	alpha: number;
}

const RAIN_DROP_SPEED = 20;
const RAIN_DROP_COUNT = 500;
const RAINING_RANGE = 10;
const RAINING_FROM_HEIGHT = 4;
const RAINDROP_TAIL_LENGTH = 0.1;

export class RainRenderer implements RendererInterface {
	canvas: HTMLCanvasElement;
	context: WebGLRenderingContext;

	// webgl default is x(right), y(up), z(out of screen = towards the viewer) = right-handed coordinate system.
	cameraTargetPosition: vec3 = vec3.fromValues(0, 2, 0);
	cameraDistance: number = 5;
	cameraPitchRadians: number = degreesToRadians(15);
	raindrops: Raindrop[] = [];
	groundY: number = 0;

	shaderProgram: WebGLProgram;
	vertexBuffer: WebGLBuffer;

	alpha: number = 0.0;

	constructor(canvasElement: HTMLCanvasElement) {
		this.canvas = canvasElement;
		this.canvas.width = this.canvas.clientWidth;
		this.canvas.height = this.canvas.clientHeight;
		this.context = this.canvas.getContext('webgl')!;
		this.context.viewport(0, 0, this.canvas.width, this.canvas.height);
		this.shaderProgram = this.context.createProgram()!;
		this.vertexBuffer = this.context.createBuffer()!;
	}

	stop() {
	}
	
	start() {
		this.initiateRaindrops();

		// Vertex shader source code
		const vertexShaderSource = `
attribute vec3 position;
attribute float alpha;
uniform mat4 viewMatrix;
uniform mat4 projectionMatrix;
varying float vAlpha;
void main() {
	gl_Position = projectionMatrix * viewMatrix * vec4(position, 1.0);
	gl_PointSize = 5.0;
	vAlpha = alpha;
}
	  `;

		// Fragment shader source code
		const fragmentShaderSource = `
precision mediump float;
varying float vAlpha;
void main() {
	gl_FragColor = vec4(1, 1, 1, vAlpha);
}
	  `;

		const gl = this.context;

		// Create shader program
		const program = gl.createProgram()!;
		const vertexShader = createShader(gl, gl.VERTEX_SHADER, vertexShaderSource);
		const fragmentShader = createShader(gl, gl.FRAGMENT_SHADER, fragmentShaderSource);
		gl.attachShader(program, vertexShader);
		gl.attachShader(program, fragmentShader);
		gl.linkProgram(program);

		// Check for linking errors
		if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
			const error = gl.getProgramInfoLog(program);
			console.error('Failed to link program:', error);
			gl.deleteProgram(program);
			return null;
		}

		gl.useProgram(program);

		this.shaderProgram = program;
	}

	initiateRaindrops() {
		this.alpha = 0.0;
		this.raindrops = [];

		for (let iMake = 0; iMake < RAIN_DROP_COUNT; iMake++) {
			const raindrop = {
				position: vec3.fromValues(
					rangedRandom(-1, 1) * RAINING_RANGE,
					rangedRandom(0.1, 1.5) * RAINING_FROM_HEIGHT,
					rangedRandom(-1, 1) * RAINING_RANGE
				),
				speedRatio: rangedRandom(0.5, 1.2),
				tailLength: rangedRandom(0.1, 1.0) * RAINDROP_TAIL_LENGTH,
				alpha: rangedRandom(0.2, 0.5),
			};
			this.raindrops.push(raindrop);
		}
	}

	update(dt: number) {
		this.drop(dt);
	}

	drop(dt: number) {
		this.alpha = clampValue(this.alpha + dt * 0.1, 0.0, 1.0);

		const dropHeight = RAIN_DROP_SPEED * dt;

		this.raindrops.forEach(drop => {
			let position = drop.position;

			position[1] -= dropHeight * drop.speedRatio;
			if (position[1] < this.groundY) {
				// reset the drop.
				position[0] = rangedRandom(-1, 1) * RAINING_RANGE;
				position[1] = rangedRandom(0.9, 1.5) * RAINING_FROM_HEIGHT;
				position[2] = rangedRandom(-1, 1) * RAINING_RANGE;
				drop.speedRatio = rangedRandom(0.5, 1.2);
				drop.tailLength = rangedRandom(0.1, 1.0) * RAINDROP_TAIL_LENGTH;
				drop.alpha = rangedRandom(0.2, 0.5);
				// TODO: make an ripple effect.
			}

			drop.position = position;
		});
	}

	updateVertexBuffer() {
		const vertexStride = 4;
		const dropStride = vertexStride * 2;
		const gl = this.context;
		const vertexBuffer = this.vertexBuffer;
		gl.bindBuffer(gl.ARRAY_BUFFER, vertexBuffer);
		const vertexData = new Float32Array(this.raindrops.length * dropStride);
		this.raindrops.forEach((drop, index) => {
			vertexData[index * dropStride] = drop.position[0];
			vertexData[index * dropStride + 1] = drop.position[1];
			vertexData[index * dropStride + 2] = drop.position[2];
			vertexData[index * dropStride + 3] = drop.alpha * this.alpha;

			vertexData[index * dropStride + 4] = drop.position[0];
			vertexData[index * dropStride + 5] = drop.position[1] - drop.tailLength;
			vertexData[index * dropStride + 6] = drop.position[2];
			vertexData[index * dropStride + 7] = drop.alpha * this.alpha;

		});

		gl.bufferData(gl.ARRAY_BUFFER, vertexData, gl.STATIC_DRAW);
	}

	getViewMatrix() {
		// make look at view matrix. (cameraDistance, cameraPitchRadians, cameraTargetPosition)
		const cameraPosition = vec3.fromValues(
			0,
			this.cameraTargetPosition[1] + this.cameraDistance * Math.sin(this.cameraPitchRadians),
			this.cameraTargetPosition[2] + this.cameraDistance * Math.cos(this.cameraPitchRadians),
		);
		let viewMatrix = mat4.create();
		mat4.lookAt(viewMatrix, cameraPosition, this.cameraTargetPosition, [0, 1, 0]);
		return viewMatrix;
	}

	getProjectionMatrix() {
		// perspective projection.
		const fovy = 60.0 / 180.0 * Math.PI;
		const aspect = this.canvas.clientWidth / this.canvas.clientHeight;
		const near = 0.1;
		const far = 100;

		const perspectiveMatrix = mat4.create();
		mat4.perspective(perspectiveMatrix, fovy, aspect, near, far);

		return perspectiveMatrix;
	}

	render() {
		this.updateVertexBuffer();

		// clear black.
		const gl = this.context;
		gl.clearColor(0, 0, 0, 1);
		gl.clear(this.context.COLOR_BUFFER_BIT | this.context.DEPTH_BUFFER_BIT);

		// alpha blend
		gl.enable(gl.BLEND);
		gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
		
		// update vertex buffer.
		const program = this.shaderProgram;
		gl.useProgram(program);

		const viewMatrixLocation = gl.getUniformLocation(program, 'viewMatrix');
		gl.uniformMatrix4fv(viewMatrixLocation, false, this.getViewMatrix());

		const projectionMatrixLocation = gl.getUniformLocation(program, 'projectionMatrix');
		gl.uniformMatrix4fv(projectionMatrixLocation, false, this.getProjectionMatrix());

		// Set up attribute pointers
		const vertexStride = 4 * Float32Array.BYTES_PER_ELEMENT;
		const positionAttributeLocation = gl.getAttribLocation(program, 'position');
		gl.enableVertexAttribArray(positionAttributeLocation);
		gl.vertexAttribPointer(positionAttributeLocation, 3, gl.FLOAT, false, vertexStride, 0);

		const alphaAttributeLocation = gl.getAttribLocation(program, 'alpha');
		gl.enableVertexAttribArray(alphaAttributeLocation);
		gl.vertexAttribPointer(alphaAttributeLocation, 1, gl.FLOAT, false, vertexStride, 3 * Float32Array.BYTES_PER_ELEMENT);

		// Draw lines
		gl.drawArrays(gl.LINES, 0, this.raindrops.length * 2);
	}
}