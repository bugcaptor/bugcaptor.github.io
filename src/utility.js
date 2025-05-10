
function degreesToRadians(degrees) {
	return degrees * Math.PI / 180;
}

function radiansToDegrees(radians) {
	return radians * 180 / Math.PI;
}

function glmVec3ToFloat32Array(glmVec3) {
	return new Float32Array([glmVec3[0], glmVec3[1], glmVec3[2]]);
}

function glmMat4ToFloat32Array(glmMat4) {
	const float32Array = new Float32Array(16);
	for (let i = 0; i < 16; i++) {
		float32Array[i] = glmMat4[i];
	}
	return float32Array;
}

function rangedRandom(min, max) {
	return Math.random() * (max - min) + min;
}

function clampValue(value, min, max) {
	return Math.min(Math.max(value, min), max);
}

function createShader(gl, type, source) {
	const shader = gl.createShader(type);
	gl.shaderSource(shader, source);
	gl.compileShader(shader);
	return shader;
}

function pickWeightedRandom(weightedRandomArray) {
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