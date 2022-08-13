import express, { Response } from 'express';

const app = express();

app.get('/', (_, res: Response) => {
    res.sendStatus(200);
});

app.get('/welcome', (_, res: Response) => {
    res.send('welcome!');
});

app.listen('4000', () => {
    console.log('Server listening on port: 4000');
});