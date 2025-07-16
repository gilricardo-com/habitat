import Document, { Html, Head, Main, NextScript } from 'next/document';

class MyDocument extends Document {
  render() {
    return (
      <Html lang="en">
        <Head>
          {/* Leaflet CSS */}
          <link 
            rel="stylesheet" 
            href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css"
          />
          {/* Leaflet JS */}
          <script 
            src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"
          ></script>
          {/* Add any other global font links or meta tags here */}
        </Head>
        <body>
          <Main />
          <NextScript />
        </body>
      </Html>
    );
  }
}

export default MyDocument;