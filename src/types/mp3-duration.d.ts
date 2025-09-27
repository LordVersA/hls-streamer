declare module 'mp3-duration' {
  function mp3Duration(
    buffer: Buffer,
    callback: (error: Error | null, duration: number) => void
  ): void;

  function mp3Duration(filePath: string): Promise<number>;
  function mp3Duration(
    filePath: string,
    callback: (error: Error | null, duration: number) => void
  ): void;

  export = mp3Duration;
}