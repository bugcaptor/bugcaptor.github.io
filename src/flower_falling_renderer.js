const FLOWER_LEAF_COUNT = 1000;
const FLOWER_LEAF_RANGE = 20;
const FLOWER_LEAF_FALLING_HEIGHT = 20;
const FLOWER_FALLING_SPEED = 5.1;
const FLOWER_SCALING = 0.15;
const WIND_VECTOR = vec3.fromValues(-3.5, 0, 2.85);

class FlowerFallingRenderer {
	constructor(canvasElement) {
		this.canvas = canvasElement;
		this.canvas.width = this.canvas.clientWidth;
		this.canvas.height = this.canvas.clientHeight;
		this.context = this.canvas.getContext('webgl');
		this.context.viewport(0, 0, this.canvas.width, this.canvas.height);
		this.shaderProgram = this.context.createProgram();
		this.vertexBuffer = this.context.createBuffer();

		this.cameraTargetPosition = vec3.fromValues(0, 9, 0);
		this.cameraDistance = 10;
		this.cameraPitchRadians = degreesToRadians(-15);
		this.flowerLeaves = [];
		this.groundY = 0;

		this.lastVertexCount = 0;
		this.alpha = 0.0;
	}

	stop() { }

	start() {
		this.initiateFlowerFalling();

		const vertexShaderSource = `
attribute vec3 position;
uniform mat4 viewMatrix;
uniform mat4 projectionMatrix;
void main() {
    gl_Position = projectionMatrix * viewMatrix * vec4(position, 1.0);
}
        `;

		const fragmentShaderSource = `
precision mediump float;
void main() {
    gl_FragColor = vec4(1, 0.75, 0.79, 1);
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
			const error = gl.getProgramInfoLog(program);
			console.error('Failed to link program:', error);
			gl.deleteProgram(program);
			return null;
		}

		gl.useProgram(program);

		this.shaderProgram = program;
	}

	initiateFlowerFalling() {
		this.alpha = 0.0;
		this.flowerLeaves = [];

		for (let iMake = 0; iMake < FLOWER_LEAF_COUNT; iMake++) {
			const flowerLeaf = {
				position: vec3.fromValues(
					rangedRandom(-1, 1) * FLOWER_LEAF_RANGE,
					rangedRandom(0.1, 1.5) * FLOWER_LEAF_FALLING_HEIGHT,
					rangedRandom(-1, 1) * FLOWER_LEAF_RANGE
				),
				rotation: vec3.fromValues(rangedRandom(0, 2 * Math.PI), rangedRandom(0, 2 * Math.PI), rangedRandom(0, 2 * Math.PI)),
				fallingSpeedRatio: rangedRandom(0.5, 1.2),
			};
			this.flowerLeaves.push(flowerLeaf);
		}
	}

	update(dt) {
		this.updateFlowerFalling(dt);
	}

	updateFlowerFalling(dt) {
		const dropHeight = FLOWER_FALLING_SPEED * dt;

		this.flowerLeaves.forEach(leaf => {
			let position = leaf.position;

			position[1] -= dropHeight * leaf.fallingSpeedRatio;

			position[0] += WIND_VECTOR[0] * dt;
			position[1] += WIND_VECTOR[1] * dt;
			position[2] += WIND_VECTOR[2] * dt;

			if (position[1] < this.groundY) {
				position[0] = rangedRandom(-1, 1) * FLOWER_LEAF_RANGE;
				position[1] = rangedRandom(0.9, 1.5) * FLOWER_LEAF_FALLING_HEIGHT;
				position[2] = rangedRandom(-1, 1) * FLOWER_LEAF_RANGE;
				leaf.fallingSpeedRatio = rangedRandom(0.5, 1.2);
				leaf.rotation = vec3.fromValues(rangedRandom(0, 2 * Math.PI), rangedRandom(0, 2 * Math.PI), rangedRandom(0, 2 * Math.PI));
			}

			const rotationSpeed = leaf.fallingSpeedRatio * dt;
			leaf.rotation[0] += rotationSpeed;
			leaf.rotation[1] += rotationSpeed;
			leaf.rotation[2] += rotationSpeed;
		});
	}

	updateVertexBuffer() {
		const leafVertices = [
			vec3.fromValues(-0.25, 0.5, 0),
			vec3.fromValues(0.0, 0.45, 0),
			vec3.fromValues(0.25, 0.5, 0),
			vec3.fromValues(0.25, 0, 0),
			vec3.fromValues(0, -0.2, 0),
			vec3.fromValues(-0.25, 0, 0),
		];

		const vertexStride = 3;
		const leafStride = vertexStride * leafVertices.length * 2;
		const gl = this.context;
		const vertexBuffer = this.vertexBuffer;
		gl.bindBuffer(gl.ARRAY_BUFFER, vertexBuffer);

		const vertexData = new Float32Array(this.flowerLeaves.length * leafStride);
		this.flowerLeaves.forEach((leaf, index) => {
			const scaledVertices = leafVertices.map(leafVertex => {
				const scaledVertex = vec3.create();
				vec3.scale(scaledVertex, leafVertex, FLOWER_SCALING);
				return scaledVertex;
			});

			const rotation = leaf.rotation;
			const rotatedVertices = scaledVertices.map(leafVertex => {
				const rotatedVertex = vec3.create();
				vec3.rotateX(rotatedVertex, leafVertex, [0, 0, 0], rotation[0]);
				vec3.rotateY(rotatedVertex, rotatedVertex, [0, 0, 0], rotation[1]);
				vec3.rotateZ(rotatedVertex, rotatedVertex, [0, 0, 0], rotation[2]);
				return rotatedVertex;
			});

			for (let i = 0; i < rotatedVertices.length; i++) {
				const rotatedVertex = rotatedVertices[i];
				rotatedVertex[0] = rotatedVertex[0] + leaf.position[0];
				rotatedVertex[1] = rotatedVertex[1] + leaf.position[1];
				rotatedVertex[2] = rotatedVertex[2] + leaf.position[2];
			}

			for (let i = 0; i < rotatedVertices.length; i++) {
				const vertex0 = rotatedVertices[i];
				const vertex1 = rotatedVertices[(i + 1) % rotatedVertices.length];

				vertexData[index * leafStride + i * vertexStride * 2 + 0] = vertex0[0];
				vertexData[index * leafStride + i * vertexStride * 2 + 1] = vertex0[1];
				vertexData[index * leafStride + i * vertexStride * 2 + 2] = vertex0[2];

				vertexData[index * leafStride + i * vertexStride * 2 + 3] = vertex1[0];
				vertexData[index * leafStride + i * vertexStride * 2 + 4] = vertex1[1];
				vertexData[index * leafStride + i * vertexStride * 2 + 5] = vertex1[2];
			}
		});

		this.lastVertexCount = vertexData.length / vertexStride;

		gl.bufferData(gl.ARRAY_BUFFER, vertexData, gl.STATIC_DRAW);
	}

	getViewMatrix() {
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

		const gl = this.context;
		gl.clearColor(1, 1, 1, 1);
		gl.clear(this.context.COLOR_BUFFER_BIT | this.context.DEPTH_BUFFER_BIT);

		gl.enable(gl.BLEND);
		gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);

		const program = this.shaderProgram;
		gl.useProgram(program);

		const viewMatrixLocation = gl.getUniformLocation(program, 'viewMatrix');
		gl.uniformMatrix4fv(viewMatrixLocation, false, this.getViewMatrix());

		const projectionMatrixLocation = gl.getUniformLocation(program, 'projectionMatrix');
		gl.uniformMatrix4fv(projectionMatrixLocation, false, this.getProjectionMatrix());

		const vertexStride = 3 * Float32Array.BYTES_PER_ELEMENT;
		const positionAttributeLocation = gl.getAttribLocation(program, 'position');
		gl.enableVertexAttribArray(positionAttributeLocation);
		gl.vertexAttribPointer(positionAttributeLocation, 3, gl.FLOAT, false, vertexStride, 0);

		gl.drawArrays(gl.LINES, 0, this.lastVertexCount);
	}
}