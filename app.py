from flask import Flask, render_template, url_for



app = Flask(__name__)


@app.route('/')
def index():

    return render_template('index.html')


@app.route('/connect')
def connect():

    return render_template('connect_four.html')

@app.route('/snake')
def snake():

    return render_template('snake.html')

@app.route('/minesweeper')
def minesweeper():

    return render_template('minesweeper.html')