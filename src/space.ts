
interface Vector3 {
	x: number;
	y: number;
	z: number;
}

function vectorAdd(a: Vector3, b: Vector3): Vector3 {
	return { x: a.x + b.x, y: a.y + b.y, z: a.z + b.z };
}

// function vectorSubtract(a: Vector3, b: Vector3): Vector3 {
// 	return { x: a.x - b.x, y: a.y - b.y, z: a.z - b.z };
// }

function vectorMultiplyScalar(a: Vector3, b: number): Vector3 {
	return { x: a.x * b, y: a.y * b, z: a.z * b };
}

function dotProduct(a: Vector3, b: Vector3): number {
	return a.x * b.x + a.y * b.y + a.z * b.z;
}

interface Star {
	position: Vector3;
	color: Vector3;
	size: number;
	speedRatio: number;
	alpha: number;
}

function rangedRandom(min: number, max: number): number {
	return Math.random() * (max - min) + min;
}

function clampValue(value: number, min: number, max: number): number {
	return Math.min(Math.max(value, min), max);
}

function createShader(gl: WebGLRenderingContext, type: number, source: string) {
	const shader = gl.createShader(type)!;
	gl.shaderSource(shader, source);
	gl.compileShader(shader);
	return shader;
}

function pickWeightedRandom<ValueType>(weightedRandomArray: [ValueType, number][]): ValueType {
	const totalWeight = weightedRandomArray.reduce((acc, val) => acc + val[1], 0);
	const randomValue = Math.random() * totalWeight;
	let currentWeight = 0;
	for (const [value, weight] of weightedRandomArray) {
		currentWeight += weight;
		if (randomValue <= currentWeight) {
			return value;
		}
	}
	return weightedRandomArray[weightedRandomArray.length - 1][0];
}

const STAR_VISUAL_RANGE = 200.0;
const STAR_COUNT = 2000;
const STAR_FLOW_SPEED = 20;

export class Space {
	canvas: HTMLCanvasElement;
	context: WebGLRenderingContext;

	// webgl default is x(right), y(up), z(out of screen = towards the viewer) = right-handed coordinate system.
	cameraPosition: Vector3 = { x: 0, y: 0, z: 0 };
	cameraDirection: Vector3 = { x: 0, y: 0, z: -1 };
	originalFlowDirection: Vector3 = { x: 0, y: 0, z: 1 };
	flowDirection: Vector3 = { x: 0, y: 0, z: 1 };
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
			position: { x: 0, y: 0, z: -5 },
			color: { x: 1, y: 1, z: 1 },
			size: 5.0,
			speedRatio: 1.0,
			alpha: 1.0
		});
		for (let i = 0; i < STAR_COUNT; i++) {
			this.stars.push({
				position: {
					x: rangedRandom(-1, 1) * STAR_VISUAL_RANGE,
					y: rangedRandom(-1, 1) * STAR_VISUAL_RANGE,
					z: rangedRandom(-1, 1) * STAR_VISUAL_RANGE
				},
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

	getStarColor(): Vector3 {
		const weightedRandomArray: [Vector3, number][] = [// first element is the value, second element is the weight.
			[{ x: 1, y: 1, z: 1 }, 50],
			[{ x: 1, y: 0, z: 0 }, 10],
			[{ x: 0, y: 1, z: 0 }, 10],
			[{ x: 0, y: 0, z: 1 }, 10],
			[{ x: 1, y: 1, z: 0 }, 10]
		];
		return pickWeightedRandom(weightedRandomArray);
	}

	flowStars(dt: number) {
		this.alpha = clampValue(this.alpha + dt * 0.1, 0.0, 1.0);
		const flowAmount = STAR_FLOW_SPEED * dt;
		this.stars.forEach(star => {
			let position = star.position;
			// move the star against the camera direction.
			position = vectorAdd(position, vectorMultiplyScalar(this.flowDirection, flowAmount * star.speedRatio));
			star.alpha = clampValue(star.alpha + dt * star.speedRatio, 0.0, 1.0);
			const outOfVisualRange = Math.abs(position.z) > STAR_VISUAL_RANGE ||
				Math.abs(position.x) > STAR_VISUAL_RANGE ||
				Math.abs(position.y) > STAR_VISUAL_RANGE;
			const outOfScreen = dotProduct(position, this.cameraDirection) < 0;
			if (outOfVisualRange || outOfScreen) {
				position.x = rangedRandom(-1, 1) * STAR_VISUAL_RANGE;
				position.y = rangedRandom(-1, 1) * STAR_VISUAL_RANGE;
				position.z = rangedRandom(-1, 1) * STAR_VISUAL_RANGE;
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
		const vertexData = new Float32Array(this.stars.length * 7);
		this.stars.forEach((star, index) => {
			vertexData[index * vertexStride] = star.position.x;
			vertexData[index * vertexStride + 1] = star.position.y;
			vertexData[index * vertexStride + 2] = star.position.z;
			vertexData[index * vertexStride + 3] = star.color.x;
			vertexData[index * vertexStride + 4] = star.color.y;
			vertexData[index * vertexStride + 5] = star.color.z;
			vertexData[index * vertexStride + 6] = star.size;
			vertexData[index * vertexStride + 7] = star.alpha * Math.min(1.0, star.speedRatio);
		});
		gl.bufferData(gl.ARRAY_BUFFER, vertexData, gl.STATIC_DRAW);
	}

	getViewMatrix() {
		const cameraPosition = this.cameraPosition;
		const cameraDirection = vectorMultiplyScalar(this.cameraDirection, -1);
		const up = { x: 0, y: 1, z: 0 };

		const zAxis = cameraDirection;
		const xAxis = {
			x: up.y * zAxis.z - up.z * zAxis.y,
			y: up.z * zAxis.x - up.x * zAxis.z,
			z: up.x * zAxis.y - up.y * zAxis.x
		};
		const yAxis = {
			x: zAxis.y * xAxis.z - zAxis.z * xAxis.y,
			y: zAxis.z * xAxis.x - zAxis.x * xAxis.z,
			z: zAxis.x * xAxis.y - zAxis.y * xAxis.x
		};

		const viewMatrix = new Float32Array(16);

		viewMatrix[0] = xAxis.x;
		viewMatrix[1] = yAxis.x;
		viewMatrix[2] = zAxis.x;
		viewMatrix[3] = 0;

		viewMatrix[4] = xAxis.y;
		viewMatrix[5] = yAxis.y;
		viewMatrix[6] = zAxis.y;
		viewMatrix[7] = 0;

		viewMatrix[8] = xAxis.z;
		viewMatrix[9] = yAxis.z;
		viewMatrix[10] = zAxis.z;
		viewMatrix[11] = 0;

		viewMatrix[12] = -dotProduct(xAxis, cameraPosition);
		viewMatrix[13] = -dotProduct(yAxis, cameraPosition);
		viewMatrix[14] = -dotProduct(zAxis, cameraPosition);
		viewMatrix[15] = 1;

		return viewMatrix;
	}

	getProjectionMatrix() {
		// perspective projection.
		const fovy = 90.0;
		const aspect = this.canvas.clientWidth / this.canvas.clientHeight;
		const near = 0.1;
		const far = STAR_VISUAL_RANGE * 2;
		const f = 1.0 / Math.tan(fovy / 2.0 * Math.PI / 180.0);
		const projectionMatrix = new Float32Array(16);
		projectionMatrix[0] = f / aspect;
		projectionMatrix[5] = f;
		projectionMatrix[10] = -(far + near) / (far - near);
		projectionMatrix[11] = -1.0;
		projectionMatrix[14] = -(2.0 * far * near) / (far - near);
		return projectionMatrix;
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
		gl.uniformMatrix4fv(viewMatrixLocation, false, this.getViewMatrix());

		const projectionMatrixLocation = gl.getUniformLocation(program, 'projectionMatrix');
		gl.uniformMatrix4fv(projectionMatrixLocation, false, this.getProjectionMatrix());

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

	setFlowDirection(yaw: number, pitch: number) {
		// rotate only cameraDirection vector.
		const flowDirection = this.originalFlowDirection;

		// rotate around y-axis.
		const cosYaw = Math.cos(yaw);
		const sinYaw = Math.sin(yaw);
		const newCameraDirection = {
			x: flowDirection.x * cosYaw - flowDirection.z * sinYaw,
			y: flowDirection.y,
			z: flowDirection.x * sinYaw + flowDirection.z * cosYaw
		};

		// rotate around x-axis.
		const cosPitch = Math.cos(pitch);
		const sinPitch = Math.sin(pitch);
		const newCameraDirection2 = {
			x: newCameraDirection.x,
			y: newCameraDirection.y * cosPitch - newCameraDirection.z * sinPitch,
			z: newCameraDirection.y * sinPitch + newCameraDirection.z * cosPitch
		};

		this.flowDirection = newCameraDirection2;
	}
}