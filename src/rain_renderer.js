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

class RainRenderer {
	constructor(canvasElement) {
		this.canvas = canvasElement;
		this.canvas.width = this.canvas.clientWidth;
		this.canvas.height = this.canvas.clientHeight;
		this.context = this.canvas.getContext('webgl');
		this.context.viewport(0, 0, this.canvas.width, this.canvas.height);

		this.cameraTargetPosition = vec3.fromValues(0, 2, 0);
		this.cameraDistance = 10;
		this.cameraPitchRadians = degreesToRadians(5);
		this.raindrops = [];
		this.groundY = 0;

		this.shaderProgram = this.context.createProgram();
		this.vertexBuffer = this.context.createBuffer();
		this.lastVertexCount = 0;
		this.alpha = 0.0;

		this.ripples = [];
		this.nextLightningTime = 0;
		this.currentLightningCount = 0;
		this.currentRemainedLightningCount = 0;
		this.currentLightningAlpha = 0;
	}

	stop() { }

	start() {
		this.initiateRaindrops();

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

		const fragmentShaderSource = `
precision mediump float;
varying float vAlpha;
void main() {
	gl_FragColor = vec4(1, 1, 1, vAlpha);
}
		`;

		const gl = this.context;
		const program = gl.createProgram();
		const vertexShader = createShader(gl, gl.VERTEX_SHADER, vertexShaderSource);
		const fragmentShader = createShader(gl, gl.FRAGMENT_SHADER, fragmentShaderSource);
		gl.attachShader(program, vertexShader);
		gl.attachShader(program, fragmentShader);
		gl.linkProgram(program);

		if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
			console.error('Failed to link program:', gl.getProgramInfoLog(program));
			gl.deleteProgram(program);
			return null;
		}

		gl.useProgram(program);
		this.shaderProgram = program;
	}

	initiateRaindrops() {
		this.alpha = 0.0;
		this.raindrops = [];

		for (let i = 0; i < RAIN_DROP_COUNT; i++) {
			this.raindrops.push({
				position: vec3.fromValues(
					rangedRandom(-1, 1) * RAINING_RANGE,
					rangedRandom(0.1, 1.5) * RAINING_FROM_HEIGHT,
					rangedRandom(-1, 1) * RAINING_RANGE
				),
				speedRatio: rangedRandom(0.5, 1.2),
				tailLength: rangedRandom(0.1, 1.0) * RAINDROP_TAIL_LENGTH,
				alpha: rangedRandom(0.2, 0.5),
			});
		}

		this.ripples = [];
	}

	update(dt) {
		this.updateDrops(dt);
		this.updateRipples(dt);
		this.updateLightning(dt);
	}

	updateLightning(dt) {
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
				if (Math.random() < LIGHTNING_PEAK_PROBABILITY) {
					console.log('Lightning!', this.currentRemainedLightningCount, this.currentLightningAlpha);
					this.currentLightningAlpha = rangedRandom(LIGHTNING_ALPHA_MIN, 1);
					this.currentRemainedLightningCount--;
				}
			}
		}
	}

	updateDrops(dt) {
		this.alpha = clampValue(this.alpha + dt * 0.1, 0.0, 1.0);
		const dropHeight = RAIN_DROP_SPEED * dt;

		this.raindrops.forEach(drop => {
			drop.position[1] -= dropHeight * drop.speedRatio;
			if (drop.position[1] < this.groundY) {
				this.makeRipple(vec3.fromValues(drop.position[0], this.groundY, drop.position[2]));
				drop.position[0] = rangedRandom(-1, 1) * RAINING_RANGE;
				drop.position[1] = rangedRandom(0.9, 1.5) * RAINING_FROM_HEIGHT;
				drop.position[2] = rangedRandom(-1, 1) * RAINING_RANGE;
				drop.speedRatio = rangedRandom(0.5, 1.2);
				drop.tailLength = rangedRandom(0.1, 1.0) * RAINDROP_TAIL_LENGTH;
				drop.alpha = rangedRandom(0.2, 0.5);
			}
		});
	}

	updateRipples(dt) {
		for (let ripple of this.ripples) {
			if (ripple.radius < 0) continue;
			ripple.radius += dt * RIPPLE_EXPAND_SPEED;
			ripple.alpha = clampValue(1 - ripple.radius / RIPPLE_RADIUS_MAX, -1, 1);
			if (ripple.alpha <= 0) {
				ripple.radius = -1;
				ripple.alpha = 0;
			}
		}
	}

	makeRipple(position) {
		let index = this.ripples.findIndex(r => r.radius < -1e-6);
		if (index === -1) {
			this.ripples.push({
				position,
				radius: rangedRandom(0.2, 0.5) * RIPPLE_RADIUS_MAX,
				alpha: 1,
			});
		} else {
			this.ripples[index].position = position;
			this.ripples[index].radius = rangedRandom(0.1, 0.3) * RIPPLE_RADIUS_MAX;
			this.ripples[index].alpha = 1;
		}
	}

	getActiveRipples() {
		return this.ripples.filter(r => r.radius >= 0);
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
			const base = index * dropStride;
			vertexData[base] = drop.position[0];
			vertexData[base + 1] = drop.position[1];
			vertexData[base + 2] = drop.position[2];
			vertexData[base + 3] = drop.alpha * this.alpha * RANIDROP_MAX_ALPHA_TAIL;

			vertexData[base + 4] = drop.position[0];
			vertexData[base + 5] = drop.position[1] - drop.tailLength;
			vertexData[base + 6] = drop.position[2];
			vertexData[base + 7] = drop.alpha * this.alpha * RANIDROP_MAX_ALPHA;
		});

		let rippleOffset = this.raindrops.length * dropStride;
		for (const ripple of activeRipples) {
			const center = ripple.position;
			const radius = ripple.radius;
			const alpha = ripple.alpha;
			for (let i = 0; i < rippleSegmentCount; i++) {
				const angle = (2 * Math.PI * i) / rippleSegmentCount;
				const angle2 = (2 * Math.PI * (i + 1)) / rippleSegmentCount;

				const x1 = Math.cos(angle) * radius + center[0];
				const z1 = Math.sin(angle) * radius + center[2];

				const x2 = Math.cos(angle2) * radius + center[0];
				const z2 = Math.sin(angle2) * radius + center[2];

				vertexData[rippleOffset] = x1;
				vertexData[rippleOffset + 1] = center[1];
				vertexData[rippleOffset + 2] = z1;
				vertexData[rippleOffset + 3] = alpha * this.alpha * RIPPLE_MAX_ALPHA;

				vertexData[rippleOffset + 4] = x2;
				vertexData[rippleOffset + 5] = center[1];
				vertexData[rippleOffset + 6] = z2;
				vertexData[rippleOffset + 7] = alpha * this.alpha * RIPPLE_MAX_ALPHA;

				rippleOffset += vertexStride * 2;
			}
		}

		this.lastVertexCount = vertexData.length / vertexStride;
		gl.bufferData(gl.ARRAY_BUFFER, vertexData, gl.STATIC_DRAW);
	}

	getViewMatrix() {
		const cameraPosition = vec3.fromValues(
			0,
			this.cameraTargetPosition[1] + this.cameraDistance * Math.sin(this.cameraPitchRadians),
			this.cameraTargetPosition[2] + this.cameraDistance * Math.cos(this.cameraPitchRadians)
		);
		const viewMatrix = mat4.create();
		mat4.lookAt(viewMatrix, cameraPosition, this.cameraTargetPosition, [0, 1, 0]);
		return viewMatrix;
	}

	getProjectionMatrix() {
		const fovy = (60.0 / 180.0) * Math.PI;
		const aspect = this.canvas.clientWidth / this.canvas.clientHeight;
		const perspectiveMatrix = mat4.create();
		mat4.perspective(perspectiveMatrix, fovy, aspect, 0.1, 100);
		return perspectiveMatrix;
	}

	render() {
		this.updateVertexBuffer();

		const gl = this.context;
		const clearColor = this.currentLightningAlpha * 0.75 + 0.25;
		gl.clearColor(clearColor, clearColor, clearColor, 1);
		gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

		gl.enable(gl.BLEND);
		gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);

		const program = this.shaderProgram;
		gl.useProgram(program);

		const viewMatrixLocation = gl.getUniformLocation(program, 'viewMatrix');
		gl.uniformMatrix4fv(viewMatrixLocation, false, this.getViewMatrix());

		const projectionMatrixLocation = gl.getUniformLocation(program, 'projectionMatrix');
		gl.uniformMatrix4fv(projectionMatrixLocation, false, this.getProjectionMatrix());

		const stride = 4 * Float32Array.BYTES_PER_ELEMENT;
		const posLoc = gl.getAttribLocation(program, 'position');
		const alphaLoc = gl.getAttribLocation(program, 'alpha');

		gl.enableVertexAttribArray(posLoc);
		gl.vertexAttribPointer(posLoc, 3, gl.FLOAT, false, stride, 0);

		gl.enableVertexAttribArray(alphaLoc);
		gl.vertexAttribPointer(alphaLoc, 1, gl.FLOAT, false, stride, 3 * Float32Array.BYTES_PER_ELEMENT);

		gl.drawArrays(gl.LINES, 0, this.lastVertexCount);
	}
}
