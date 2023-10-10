# hls-streamer

## Description

The `hls-streamer` npm package allows you to create and stream HLS (HTTP Live Streaming) from an MP3 file on demand, without the need to store any temporary files or use `ffmpeg`.

## Installation

You can install this package using Yarn or npm:

```bash
npm install hls-streamer
# or
yarn add hls-streamer
```


## Usage
To use hls-streamer, you can create an instance of HlsStreamer with the following options:


```js
const hls = new HlsStreamer({
  filePath: `file.mp3`,
  lessSizeForFirst2Segments: true,
  basePath: `segments/<token>`,
});
```
## Options

`filePath`: The path to the MP3 file you want to stream.
`segmentSize`: The size of each segment in bytes (default is 512 KB).
`fileName`: The base name for the segments (default is "file").
`basePath`: The base path where segments will be stored.
`lessSizeForFirst2Segments`: Whether to reduce the size of the first 2 segments (default is false).

You can send the M3U8 file with Express like this:

```js
res.send(await hls.createM3U8());
```

To get a specific range of bytes from the file, you can use the following function:

```js
await hls.getFileBuffer(+req.params.start, +req.params.end);
```

Make sure to set up your Express routes accordingly:

```js
app.get("/segments/:token/:quality/:start/:end/:any.mp3", async (req, res) => {
  // Create a new HlsStreamer instance with appropriate options
  const hls = new HlsStreamer({
    filePath: `file.mp3`,
    lessSizeForFirst2Segments: true,
    basePath: `segments/<token>`,
  });

  // Send the requested file buffer
  res.setHeader("Content-Type", "application/octet-stream");
  res.send(await hls.getFileBuffer(+req.params.start, +req.params.end));
});
```

## License
This package is open-source and free to use in any project. There are no specific licensing restrictions.

## Issues
If you encounter any issues or have questions, please feel free to open an issue on GitHub.