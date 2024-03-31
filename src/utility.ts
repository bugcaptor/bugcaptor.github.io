
export interface Vector3 {
	x: number;
	y: number;
	z: number;
}

export function vectorAdd(a: Vector3, b: Vector3): Vector3 {
	return { x: a.x + b.x, y: a.y + b.y, z: a.z + b.z };
}

// function vectorSubtract(a: Vector3, b: Vector3): Vector3 {
// 	return { x: a.x - b.x, y: a.y - b.y, z: a.z - b.z };
// }

export function vectorMultiplyScalar(a: Vector3, b: number): Vector3 {
	return { x: a.x * b, y: a.y * b, z: a.z * b };
}

export function dotProduct(a: Vector3, b: Vector3): number {
	return a.x * b.x + a.y * b.y + a.z * b.z;
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