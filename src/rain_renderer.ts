import { RendererInterface } from './renderer';
import { clampValue, createShader, degreesToRadians, rangedRandom } from './utility';
import { mat4, vec3 } from 'gl-matrix';

interface Raindrop {
	position: vec3;
	tailLength: number;
	speedRatio: number;
	alpha: number;
}

interface Ripple {
	position: vec3;
	radius: number;
	alpha: number;
}

const RAIN_DROP_SPEED = 20;
const RAIN_DROP_COUNT = 1000;
const RAINING_RANGE = 20;
const RAINING_FROM_HEIGHT = 10;
const RAINDROP_TAIL_LENGTH = 0.5;
const RANIDROP_MAX_ALPHA = 0.6;
const RANIDROP_MAX_ALPHA_TAIL = 0.2;

const RIPPLE_EXPAND_SPEED = 0.5;
const RIPPLE_RADIUS_MAX = 0.25;
const RIPPLE_MAX_ALPHA = 0.5;
const RIPPLE_CIRCLE_SEGMENT_COUNT = 16;

const LIGHTNING_INTERVAL_MIN = 5;
const LIGHTNING_INTERVAL_MAX = 60;
const LIGHTNING_INTERVAL_SUB_COUNT_MAX = 3;
const LIGHTNING_PEAK_PROBABILITY = 0.5;
const LIGHTNING_ALPHA_DECAY_SPEED = 5;
const LIGHTNING_ALPHA_MIN = 0.5;

export class RainRenderer implements RendererInterface {
	canvas: HTMLCanvasElement;
	context: WebGLRenderingContext;

	// webgl default is x(right), y(up), z(out of screen = towards the viewer) = right-handed coordinate system.
	cameraTargetPosition: vec3 = vec3.fromValues(0, 2, 0);
	cameraDistance: number = 10;
	cameraPitchRadians: number = degreesToRadians(5);
	raindrops: Raindrop[] = [];
	groundY: number = 0;

	shaderProgram: WebGLProgram;
	vertexBuffer: WebGLBuffer;
	lastVertexCount: number = 0;

	alpha: number = 0.0;

	ripples: Ripple[] = [];

	nextLightningTime: number = 0;
	currentLightningCount: number = 0;
	currentRemainedLightningCount: number = 0;
	currentLightningAlpha: number = 0;

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

		this.ripples = [];
	}

	update(dt: number) {
		this.updateDrops(dt);
		this.updateRipples(dt);
		this.updateLightning(dt);
	}

	updateLightning(dt: number) {
		const now = performance.now();
		if (now > this.nextLightningTime) {
			const nextInterval = rangedRandom(LIGHTNING_INTERVAL_MIN, LIGHTNING_INTERVAL_MAX);
			console.log('Next lightning in ', Math.floor(nextInterval), ' seconds');
			this.nextLightningTime = now + nextInterval * 1000;
			this.currentLightningCount = this.currentRemainedLightningCount = Math.floor(rangedRandom(1, LIGHTNING_INTERVAL_SUB_COUNT_MAX));
		} else {
			const decaySpeed = (this.currentRemainedLightningCount > 0) ? LIGHTNING_ALPHA_DECAY_SPEED : 1;
			this.currentLightningAlpha = Math.max(0, this.currentLightningAlpha - dt * decaySpeed);
			if (this.currentRemainedLightningCount > 0 && this.currentLightningAlpha < 1e-4) {
				const rng = Math.random();
				if (rng < LIGHTNING_PEAK_PROBABILITY) {
					console.log('Lightning!', this.currentRemainedLightningCount, this.currentLightningAlpha);
					this.currentLightningAlpha = rangedRandom(LIGHTNING_ALPHA_MIN, 1);
					this.currentRemainedLightningCount -= 1;
				}
			}
		}
	}

	updateDrops(dt: number) {
		this.alpha = clampValue(this.alpha + dt * 0.1, 0.0, 1.0);

		const dropHeight = RAIN_DROP_SPEED * dt;

		this.raindrops.forEach(drop => {
			let position = drop.position;

			position[1] -= dropHeight * drop.speedRatio;
			if (position[1] < this.groundY) {
				// make an ripple effect.
				this.makeRipple(vec3.fromValues(position[0], this.groundY, position[2]));
				// reset the drop.
				position[0] = rangedRandom(-1, 1) * RAINING_RANGE;
				position[1] = rangedRandom(0.9, 1.5) * RAINING_FROM_HEIGHT;
				position[2] = rangedRandom(-1, 1) * RAINING_RANGE;
				drop.speedRatio = rangedRandom(0.5, 1.2);
				drop.tailLength = rangedRandom(0.1, 1.0) * RAINDROP_TAIL_LENGTH;
				drop.alpha = rangedRandom(0.2, 0.5);
			}

			drop.position = position;
		});
	}

	updateRipples(dt: number) {
		for (let i = 0; i < this.ripples.length; i++) {
			const ripple = this.ripples[i];
			if (ripple.radius < 0) {
				continue;
			}
			ripple.radius += dt * RIPPLE_EXPAND_SPEED;
			ripple.alpha = clampValue(1 - ripple.radius / RIPPLE_RADIUS_MAX, -1, 1);
			if (ripple.alpha <= 0) {
				ripple.radius = -1;
				ripple.alpha = 0;
			}
		}
	}

	makeRipple(position: vec3) {
		// find empty ripple slot.
		let emptyRippleIndex = -1;
		for (let i = 0; i < this.ripples.length; i++) {
			// if radius is 0 or less, it's empty.
			if (this.ripples[i].radius < -1e-6) {
				emptyRippleIndex = i;
				break;
			}
		}
		if (emptyRippleIndex === -1) {
			emptyRippleIndex = this.ripples.length;
			this.ripples.push({
				position: position,
				radius: rangedRandom(0.2, 0.5) * RIPPLE_RADIUS_MAX,
				alpha: 1,
			});
		} else {
			this.ripples[emptyRippleIndex].radius = rangedRandom(0.1, 0.3) * RIPPLE_RADIUS_MAX;
			this.ripples[emptyRippleIndex].alpha = 1;
			this.ripples[emptyRippleIndex].position = position;
		}
	}

	getActiveRipples(): Ripple[] {
		const activeRipples: Ripple[] = [];
		for (let i = 0; i < this.ripples.length; i++) {
			const ripple = this.ripples[i];
			if (ripple.radius < 0) {
				continue;
			}
			activeRipples.push(ripple);
		}
		return activeRipples;
	}

	updateVertexBuffer() {
		const vertexStride = 4;
		const dropStride = vertexStride * 2;
		const gl = this.context;
		const vertexBuffer = this.vertexBuffer;
		gl.bindBuffer(gl.ARRAY_BUFFER, vertexBuffer);

		const activeRipples = this.getActiveRipples();
		const rippleSegmentCount = RIPPLE_CIRCLE_SEGMENT_COUNT;

		const vertexData = new Float32Array(this.raindrops.length * dropStride + activeRipples.length * rippleSegmentCount * 2 * vertexStride);
		this.raindrops.forEach((drop, index) => {
			vertexData[index * dropStride] = drop.position[0];
			vertexData[index * dropStride + 1] = drop.position[1];
			vertexData[index * dropStride + 2] = drop.position[2];
			vertexData[index * dropStride + 3] = drop.alpha * this.alpha * RANIDROP_MAX_ALPHA_TAIL;

			vertexData[index * dropStride + 4] = drop.position[0];
			vertexData[index * dropStride + 5] = drop.position[1] - drop.tailLength;
			vertexData[index * dropStride + 6] = drop.position[2];
			vertexData[index * dropStride + 7] = drop.alpha * this.alpha * RANIDROP_MAX_ALPHA;

		});

		//
		let rippleOffset = this.raindrops.length * dropStride;
		for (let iRipple = 0; iRipple < activeRipples.length; ++iRipple) {
			// make a circle.
			const rippleCenter = activeRipples[iRipple].position;
			const rippleRadius = activeRipples[iRipple].radius;
			const rippleAlpha = activeRipples[iRipple].alpha;
			for (let iSegment = 0; iSegment < rippleSegmentCount; ++iSegment) {
				const angle = Math.PI * 2 * iSegment / rippleSegmentCount;
				const x = Math.cos(angle) * rippleRadius + rippleCenter[0];
				const z = Math.sin(angle) * rippleRadius + rippleCenter[2];

				const angle2 = Math.PI * 2 * (iSegment + 1) / rippleSegmentCount;
				const x2 = Math.cos(angle2) * rippleRadius + rippleCenter[0];
				const z2 = Math.sin(angle2) * rippleRadius + rippleCenter[2];

				vertexData[rippleOffset + 0] = x;
				vertexData[rippleOffset + 1] = rippleCenter[1];
				vertexData[rippleOffset + 2] = z;
				vertexData[rippleOffset + 3] = rippleAlpha * this.alpha * RIPPLE_MAX_ALPHA;

				vertexData[rippleOffset + 4] = x2;
				vertexData[rippleOffset + 5] = rippleCenter[1];
				vertexData[rippleOffset + 6] = z2;
				vertexData[rippleOffset + 7] = rippleAlpha * this.alpha * RIPPLE_MAX_ALPHA;

				rippleOffset += vertexStride * 2;
			}
		}

		this.lastVertexCount = vertexData.length / vertexStride;

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
		const clearColorIntensity = this.currentLightningAlpha * 0.75 + 0.25;
		gl.clearColor(clearColorIntensity, clearColorIntensity, clearColorIntensity, 1);
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
		gl.drawArrays(gl.LINES, 0, this.lastVertexCount);
	}
}