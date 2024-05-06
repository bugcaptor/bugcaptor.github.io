import { RendererInterface } from './renderer';
import { createShader, degreesToRadians, rangedRandom } from './utility';
import { mat4, vec2, vec3 } from 'gl-matrix';

interface Wave {
    progress: number; // [0, 1]
    xBias: number;
}

interface WaveParticle {
	position: vec3;
    rotation: vec3;
    age: number; // [0, 1]
}

const WAVE_COUNT = 3;
const WAVE_BIAS_MIN = 0.01;
const WAVE_BIAS_MAX = 0.03;
const WAVE_PROGRESS_SPEED = 0.3;

const WAVE_BREAKING_START_PROGRESS = 0.9;
const WAVE_PARTICLE_SAMPLING_COUNT = 10;

const WAVE_WIDTH = 10;
const WAVE_DISTANCE_DEPTH = 30;

const WAVE_PARTICLE_AGE_RANDOM = 0.1;
const WAVE_PARTICLE_ROTATION_SPEED = 0.1;
const WAVE_PARTICLE_AGING_SPEED = 1;

const WAVEPARTICLE_SCALING = 0.15;

export class WaveBreakingRenderer implements RendererInterface {
	canvas: HTMLCanvasElement;
	context: WebGLRenderingContext;

	// webgl default is x(right), y(up), z(out of screen = towards the viewer) = right-handed coordinate system.
	cameraDistance: number = 10;
	cameraPitchRadians: number = degreesToRadians(-15);
	waveParticles: WaveParticle[] = [];
    waves: Wave[] = [];
	groundY: number = 0;

	shaderProgram: WebGLProgram;
	vertexBuffer: WebGLBuffer;
	lastVertexCount: number = 0;

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
		this.initiateWaveBreaking();

		// Vertex shader source code
		const vertexShaderSource = `
attribute vec3 position;
uniform mat4 viewMatrix;
uniform mat4 projectionMatrix;
void main() {
	gl_Position = projectionMatrix * viewMatrix * vec4(position, 1.0);
}
	  `;

		// Fragment shader source code
		const fragmentShaderSource = `
precision mediump float;
void main() {
	gl_FragColor = vec4(1, 1, 1, 1);
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

	initiateWaveBreaking() {
		this.alpha = 0.0;
		this.waveParticles = [];

        for (let iMake = 0; iMake < WAVE_COUNT; iMake++) {
            const wave = {
                progress: iMake / WAVE_COUNT + rangedRandom(-0.25, 0.25) / WAVE_COUNT,
                xBias: rangedRandom(WAVE_BIAS_MIN, WAVE_BIAS_MAX),
            };
            this.waves.push(wave);
        }
	}

	update(dt: number) {
        this.updateWave(dt);
		this.updateWaveBreaking(dt);
	}

    updateWave(dt: number) {
        for (let iWave = 0; iWave < this.waves.length; iWave++) {
            const wave = this.waves[iWave];
            wave.progress += WAVE_PROGRESS_SPEED * dt;
            if (wave.progress > 1) {
                wave.progress = 0;
                wave.xBias = rangedRandom(WAVE_BIAS_MIN, WAVE_BIAS_MAX);
            }
        }
    }

	updateWaveBreaking(dt: number) {
        // spawn new wave particles.
        for (let iWave = 0; iWave < this.waves.length; iWave++) {
            const wave = this.waves[iWave];
            if (wave.progress < WAVE_BREAKING_START_PROGRESS) {
                continue;
            }

            for (let iSample = 0; iSample < WAVE_PARTICLE_SAMPLING_COUNT; iSample++) {
                const sampleX = rangedRandom(0, 1);
                const biasedProgress = wave.progress - sampleX * wave.xBias;
                if (biasedProgress < 0 || biasedProgress > 1) {
                    continue;
                }
                const waveZ = (1 - biasedProgress) * -WAVE_DISTANCE_DEPTH;
                // time to spawn!
                const newWaveParticle = {
                    position: vec3.fromValues((sampleX - 0.5) * WAVE_WIDTH, 0, waveZ),
                    rotation: vec3.fromValues(rangedRandom(0, 2 * Math.PI), rangedRandom(0, 2 * Math.PI), rangedRandom(0, 2 * Math.PI)),
                    age: 0 + rangedRandom(0, WAVE_PARTICLE_AGE_RANDOM),
                };
                this.waveParticles.push(newWaveParticle);
            }
        }

        // update wave particles.
        for (let iParticle = 0; iParticle < this.waveParticles.length; iParticle++) {
            const particle = this.waveParticles[iParticle];
            // rotate
            const rotationAmount = WAVE_PARTICLE_ROTATION_SPEED * dt;
            particle.rotation[0] += rotationAmount;
            particle.rotation[1] += rotationAmount;
            particle.rotation[2] += rotationAmount;

            particle.age += dt * WAVE_PARTICLE_AGING_SPEED;

            if (particle.age > 1) {
                this.waveParticles.splice(iParticle, 1);
                iParticle--;
            }
		}
	}

    static equilateralTriangleVertices(centerX: number, centerY: number, height: number): vec2[] {
        // Calculate the distance from the center to each vertex (the radius of the circumcircle)
        const radius: number = height * Math.sqrt(3) / 3;
    
        // Calculate the coordinates of the vertices
        const vertex1X: number = centerX;
        const vertex1Y: number = centerY + radius;
    
        const vertex2X: number = centerX + (radius * Math.cos(120 * Math.PI / 180));
        const vertex2Y: number = centerY - (radius * Math.sin(120 * Math.PI / 180));
    
        const vertex3X: number = centerX + (radius * Math.cos(240 * Math.PI / 180));
        const vertex3Y: number = centerY - (radius * Math.sin(240 * Math.PI / 180));
    
        // Return the coordinates of the vertices
        return [vec2.fromValues(vertex1X, vertex1Y), vec2.fromValues(vertex2X, vertex2Y), vec2.fromValues(vertex3X, vertex3Y)];
    }    

	updateVertexBuffer() {
        const heightOfTriangle = 1;
        const trianglePoints = WaveBreakingRenderer.equilateralTriangleVertices(0, 0, heightOfTriangle);

        const particleVertices = [
            vec3.fromValues(trianglePoints[0][0], trianglePoints[0][1], 0),
            vec3.fromValues(trianglePoints[1][0], trianglePoints[1][1], 0),
            vec3.fromValues(trianglePoints[2][0], trianglePoints[2][1], 0),
        ];
        
		const vertexStride = 3; // one vertex stride
        const waveParticleStride = vertexStride * particleVertices.length * 2; // line primitive stride
		const gl = this.context;
		const vertexBuffer = this.vertexBuffer;
		gl.bindBuffer(gl.ARRAY_BUFFER, vertexBuffer);

		const vertexData = new Float32Array(this.waveParticles.length * waveParticleStride);
        this.waveParticles.forEach((particle, index) => {
            // scale the particle.
            const scaledVertices = particleVertices.map(particleVertex => {
                const scaledVertex = vec3.create();
                vec3.scale(scaledVertex, particleVertex, WAVEPARTICLE_SCALING);
                return scaledVertex;
            });
            // rotate the particle.
            const rotation = particle.rotation;
            const rotatedVertices = scaledVertices.map(particleVertex => {
                const rotatedVertex = vec3.create();
                vec3.rotateX(rotatedVertex, particleVertex, [0, 0, 0], rotation[0]);
                vec3.rotateY(rotatedVertex, rotatedVertex, [0, 0, 0], rotation[1]);
                vec3.rotateZ(rotatedVertex, rotatedVertex, [0, 0, 0], rotation[2]);
                return rotatedVertex;
            });
            // translate the particle.
            for (let i = 0; i < rotatedVertices.length; i++) {
                const rotatedVertex = rotatedVertices[i];
                rotatedVertex[0] = rotatedVertex[0] + particle.position[0];
                rotatedVertex[1] = rotatedVertex[1] + particle.position[1];
                rotatedVertex[2] = rotatedVertex[2] + particle.position[2];
            }

            // add the leaf to the vertex buffer (lines)
            for (let i = 0; i < rotatedVertices.length; i++) {
                const vertex0 = rotatedVertices[i];
                const vertex1 = rotatedVertices[(i + 1) % rotatedVertices.length];

                vertexData[index * waveParticleStride + i * vertexStride * 2 + 0] = vertex0[0];
                vertexData[index * waveParticleStride + i * vertexStride * 2 + 1] = vertex0[1];
                vertexData[index * waveParticleStride + i * vertexStride * 2 + 2] = vertex0[2];
                
                vertexData[index * waveParticleStride + i * vertexStride * 2 + 3] = vertex1[0];
                vertexData[index * waveParticleStride + i * vertexStride * 2 + 4] = vertex1[1];
                vertexData[index * waveParticleStride + i * vertexStride * 2 + 5] = vertex1[2];
            }

		});

        this.lastVertexCount = vertexData.length / vertexStride;

		gl.bufferData(gl.ARRAY_BUFFER, vertexData, gl.STATIC_DRAW);
	}

	getViewMatrix() {
		// make look at view matrix. (cameraDistance, cameraPitchRadians, cameraTargetPosition)
		const cameraPosition = vec3.fromValues(
			0,
			1,
			3,
		);
        const cameraTargetPosition = vec3.fromValues(0, 0, 0);
		let viewMatrix = mat4.create();
		mat4.lookAt(viewMatrix, cameraPosition, cameraTargetPosition, [0, 1, 0]);
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

		// clear white.
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
		const vertexStride = 3 * Float32Array.BYTES_PER_ELEMENT;
		const positionAttributeLocation = gl.getAttribLocation(program, 'position');
		gl.enableVertexAttribArray(positionAttributeLocation);
		gl.vertexAttribPointer(positionAttributeLocation, 3, gl.FLOAT, false, vertexStride, 0);

		// Draw lines
		gl.drawArrays(gl.LINES, 0, this.lastVertexCount);
	}
}