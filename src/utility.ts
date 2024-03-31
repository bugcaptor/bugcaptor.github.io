import { vec3, mat4 } from 'gl-matrix';

export function degreesToRadians(degrees: number): number {
	return degrees * Math.PI / 180;
}

export function radiansToDegrees(radians: number): number {
	return radians * 180 / Math.PI;
}

export function glmVec3ToFloat32Array(glmVec3: vec3): Float32Array {
	return new Float32Array([glmVec3[0], glmVec3[1], glmVec3[2]]);
}

export function glmMat4ToFloat32Array(glmMat4: mat4): Float32Array {
	const float32Array = new Float32Array(16);
	for (let i = 0; i < 16; i++) {
		float32Array[i] = glmMat4[i];
	}
	return float32Array;
}

export function rangedRandom(min: number, max: number): number {
	return Math.random() * (max - min) + min;
}

export function clampValue(value: number, min: number, max: number): number {
	return Math.min(Math.max(value, min), max);
}

export function createShader(gl: WebGLRenderingContext, type: number, source: string) {
	const shader = gl.createShader(type)!;
	gl.shaderSource(shader, source);
	gl.compileShader(shader);
	return shader;
}

export function pickWeightedRandom<ValueType>(weightedRandomArray: [ValueType, number][]): ValueType {
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