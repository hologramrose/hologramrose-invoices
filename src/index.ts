import express from 'express';
import ensureRootUrl from 'ensure-root-url';
import fetch from 'node-fetch';
import mustache from 'mustache';
import {minify} from 'html-minifier';
import stripJs from 'strip-js';

import requireGraphQL from './require-graphql';
import client from './graphql-client';

const port = process.env.PORT || '5000';
const rootUrl = process.env.ROOT_URL || 'http://localhost:5000';
const query = requireGraphQL('./Invoice');

async function getTemplate() {
  const response = await fetch(
    'https://s3.amazonaws.com/hologramrose-staging/invoice.html',
  );
  return response.text();
}

function generateHtml(template: string, invoice: InvoiceDoc) {
  // const template = requireFile('./invoice.html');

  const view = {
    // ...data,
    ...invoice,

    // Helpers
    // TODO: Find a community package for helpers instead of these
    nl2pbr: function() {
      return function(text: string, render: (text: string) => string) {
        return render(text)
          .split(/\s*\n\s*\n\s*/)
          .map(e => `<p>${e}</p>`)
          .join('')
          .replace(/\n/g, '<br />');
      };
    },
    nl2br: function() {
      return function(text: string, render: Function) {
        return render(text).replace(/\s*\n\s*/g, '<br />');
      };
    },
  };

  // Render the html invoice
  // https://www.npmjs.com/package/mustache
  let html = mustache.render(template, view);

  // Remove all JavaScript from the template
  // https://www.npmjs.com/package/strip-js
  html = stripJs(html, {preserveDoctypes: true});

  // Restrict HTML tags
  // https://www.npmjs.com/package/sanitize-html

  // Minify the HTML
  // https://www.npmjs.com/package/html-minifier
  return minify(html, {minifyCSS: true, collapseWhitespace: true});
}

async function getInvoice(token: string) {
  const variables = {
    token,
  };
  return client(query, variables);
}

async function server() {
  const template = await getTemplate();
  const app = express();

  app.use(ensureRootUrl(rootUrl));

  app.use('/favicon.ico', async (req, res) => {
    res.send(404);
  });

  app.use('/:token', async (req, res) => {
    const invoice = await getInvoice(req.params.token);
    console.dir(invoice, {depth: null});

    res.send(generateHtml(template, invoice.data.invoice));
  });

  app.listen(Number(port));
}

(async function() {
  try {
    await server();
    console.log(`-> HTTP server running on port ${port}`);
  } catch (error) {
    console.error(error);
  }
})();