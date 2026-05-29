import heroImg from './assets/hero.png'
import './App.css'

function App() {

  return (
    <>
      <section id="center">
        <div className="hero">
          <img src={heroImg} className="base" width="170" height="179" alt="" />
          <p className="title">Test App</p>
        </div>

      </section>
    </>
  )
}

export default App
