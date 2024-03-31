import { RendererInterface } from './renderer';
import { clampValue, createShader, glmMat4ToFloat32Array, pickWeightedRandom, rangedRandom, } from './utility';
import { vec3, mat4 } from 'gl-matrix';

interface Star {
	position: vec3;
	color: vec3;
	size: number;
	speedRatio: number;
	alpha: number;
}

const STAR_VISUAL_RANGE = 200.0;
const STAR_COUNT = 2000;
const STAR_FLOW_SPEED = 20;

export class SpaceRenderer implements RendererInterface {
	canvas: HTMLCanvasElement;
	context: WebGLRenderingContext;

	// webgl default is x(right), y(up), z(out of screen = towards the viewer) = right-handed coordinate system.
	cameraPosition: vec3 = vec3.fromValues(0, 0, 0);
	cameraDirection: vec3 = vec3.fromValues(0, 0, -1);
	originalFlowDirection: vec3 = vec3.fromValues(0, 0, 1);
	flowDirection: vec3 = vec3.fromValues(0, 0, 1);
	stars: Star[] = [];

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
		this.initiateStars();

		// Vertex shader source code
		const vertexShaderSource = `
attribute vec3 position;
attribute vec3 color;
attribute float size;
attribute float alpha;
varying vec3 vColor;
varying float vAlpha;
uniform mat4 viewMatrix;
uniform mat4 projectionMatrix;
void main() {
	gl_Position = projectionMatrix * viewMatrix * vec4(position, 1.0);
	vColor = color;
	vAlpha = alpha;
	gl_PointSize = size;
}
	  `;

		// Fragment shader source code
		const fragmentShaderSource = `
precision mediump float;
varying vec3 vColor;
varying float vAlpha;
uniform float alpha;
void main() {
	gl_FragColor = vec4(vColor, alpha * vAlpha);
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

	initiateStars() {
		this.alpha = 0.0;
		this.stars = [];
		this.stars.push({ // default test star.
			position: vec3.fromValues(0, 0, -5),
			color: vec3.fromValues(1, 1, 1),
			size: 5.0,
			speedRatio: 1.0,
			alpha: 1.0
		});
		for (let i = 0; i < STAR_COUNT; i++) {
			this.stars.push({
				position: vec3.fromValues(
					rangedRandom(-1, 1) * STAR_VISUAL_RANGE,
					rangedRandom(-1, 1) * STAR_VISUAL_RANGE,
					rangedRandom(-1, 1) * STAR_VISUAL_RANGE
				),
				color: this.getStarColor(),
				size: rangedRandom(1.0, 3.0),
				speedRatio: this.getStarSpeedRatio(),
				alpha: rangedRandom(0.5, 1.0)
			});
		}
	}

	getStarSpeedRatio(): number {
		const weightedRandomArray: [number, number][] = [// first element is the value, second element is the weight.
			[0.1, 5],
			[0.2, 10],
			[0.3, 15],
			[0.4, 20],
			[0.5, 25],
			[0.6, 20],
			[0.7, 15],
			[0.8, 10],
			[0.9, 5],
			[1, 200],
			[10, 100],
			[20, 50],
		];
		return pickWeightedRandom(weightedRandomArray);	
	}

	getStarColor(): vec3 {
		const weightedRandomArray: [vec3, number][] = [// first element is the value, second element is the weight.
			[[1, 1, 1], 50],
			[[ 1, 0, 0 ], 10],
			[[ 0, 1, 0 ], 10],
			[[ 0, 0, 1 ], 10],
			[[ 1, 1, 0 ], 10]
		];
		return pickWeightedRandom(weightedRandomArray);
	}

	update(dt: number) {
		this.flowStars(dt);
	}

	flowStars(dt: number) {
		this.alpha = clampValue(this.alpha + dt * 0.1, 0.0, 1.0);
		const flowAmount = STAR_FLOW_SPEED * dt;
		this.stars.forEach(star => {
			let position = star.position;
			// move the star against the camera direction.
			vec3.add(position, position, vec3.scale(vec3.create(), this.flowDirection, flowAmount * star.speedRatio));
			star.alpha = clampValue(star.alpha + dt * star.speedRatio, 0.0, 1.0);
			const outOfVisualRange = Math.abs(position[2]) > STAR_VISUAL_RANGE ||
				Math.abs(position[0]) > STAR_VISUAL_RANGE ||
				Math.abs(position[1]) > STAR_VISUAL_RANGE;
			const outOfScreen = (vec3.dot(position, this.cameraDirection) < 0);
			if (outOfVisualRange || outOfScreen) {
				position[0] = rangedRandom(-1, 1) * STAR_VISUAL_RANGE;
				position[1] = rangedRandom(-1, 1) * STAR_VISUAL_RANGE;
				position[2] = rangedRandom(-1, 1) * STAR_VISUAL_RANGE;
				star.alpha = 0.0;
				star.color = this.getStarColor();
				star.speedRatio = this.getStarSpeedRatio();
			}
			star.position = position;
		});
	}

	updateVertexBuffer() {
		const vertexStride = 8;
		const gl = this.context;
		const vertexBuffer = this.vertexBuffer;
		gl.bindBuffer(gl.ARRAY_BUFFER, vertexBuffer);
		const vertexData = new Float32Array(this.stars.length * vertexStride);
		this.stars.forEach((star, index) => {
			vertexData[index * vertexStride] = star.position[0];
			vertexData[index * vertexStride + 1] = star.position[1];
			vertexData[index * vertexStride + 2] = star.position[2];
			vertexData[index * vertexStride + 3] = star.color[0];
			vertexData[index * vertexStride + 4] = star.color[1];
			vertexData[index * vertexStride + 5] = star.color[2];
			vertexData[index * vertexStride + 6] = star.size;
			vertexData[index * vertexStride + 7] = star.alpha * Math.min(1.0, star.speedRatio);
		});
		gl.bufferData(gl.ARRAY_BUFFER, vertexData, gl.STATIC_DRAW);
	}

	getViewMatrix() {
		const cameraTarget = vec3.add(vec3.create(), this.cameraPosition, this.cameraDirection);
		const up = vec3.fromValues(0, 1, 0);

		const viewMatrix = mat4.lookAt(mat4.create(), this.cameraPosition, cameraTarget, up);
		return viewMatrix;
	}

	getProjectionMatrix() {
		// perspective projection.
		const fovy = 90.0 * Math.PI / 180.0;
		const aspect = this.canvas.clientWidth / this.canvas.clientHeight;
		const near = 0.1;
		const far = 100;

		return mat4.perspective(mat4.create(), fovy, aspect, near, far);
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
		

		// draw stars in 3D.
		// update vertex buffer.
		const program = this.shaderProgram;
		gl.useProgram(program);

		const viewMatrixLocation = gl.getUniformLocation(program, 'viewMatrix');
		gl.uniformMatrix4fv(viewMatrixLocation, false, glmMat4ToFloat32Array(this.getViewMatrix()));

		const projectionMatrixLocation = gl.getUniformLocation(program, 'projectionMatrix');
		gl.uniformMatrix4fv(projectionMatrixLocation, false, glmMat4ToFloat32Array(this.getProjectionMatrix()));

		// Set up attribute pointers
		const vertexStride = 8 * Float32Array.BYTES_PER_ELEMENT;
		const positionAttributeLocation = gl.getAttribLocation(program, 'position');
		gl.enableVertexAttribArray(positionAttributeLocation);
		gl.vertexAttribPointer(positionAttributeLocation, 3, gl.FLOAT, false, vertexStride, 0);

		const colorAttributeLocation = gl.getAttribLocation(program, 'color');
		gl.enableVertexAttribArray(colorAttributeLocation);
		gl.vertexAttribPointer(colorAttributeLocation, 3, gl.FLOAT, false, vertexStride, 3 * Float32Array.BYTES_PER_ELEMENT);

		const sizeAttributeLocation = gl.getAttribLocation(program, 'size');
		gl.enableVertexAttribArray(sizeAttributeLocation);
		gl.vertexAttribPointer(sizeAttributeLocation, 1, gl.FLOAT, false, vertexStride, 6 * Float32Array.BYTES_PER_ELEMENT);

		const alphaAttributeLocation = gl.getAttribLocation(program, 'alpha');
		gl.enableVertexAttribArray(alphaAttributeLocation);
		gl.vertexAttribPointer(alphaAttributeLocation, 1, gl.FLOAT, false, vertexStride, 7 * Float32Array.BYTES_PER_ELEMENT);

		const alphaLocation = gl.getUniformLocation(program, 'alpha');
		gl.uniform1f(alphaLocation, this.alpha);

		// Draw points
		gl.drawArrays(gl.POINTS, 0, this.stars.length);
	}
}