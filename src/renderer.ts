export interface RendererInterface {
	start(): void;
	stop(): void;
	render(): void;
	update(deltaTimeSec: number): void;
}