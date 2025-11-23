# Tokensa Local Server

Serveur d'inférence local pour [tokensa.com](https://tokensa.com).

## Prérequis

- **Windows 10 / 11**
- **Node.js ≥ 20**
- **Ollama** ([https://ollama.com](https://ollama.com))
- Modèle téléchargé :
  ```bash
  ollama run qwen3:4b
  ```

## Lancement

```bash
npm install
npm run dev
```

Par défaut, le serveur écoute désormais sur toutes les interfaces réseau (`HOST=0.0.0.0`, `PORT=3327`).
Cela permet aux appareils extérieurs (smartphones, autres ordinateurs) d'appeler l'API via l'adresse IP
publique de la box, à condition que le port soit ouvert/redirigé sur le routeur.

Vous pouvez ajuster l'écoute avec des variables d'environnement :

```bash
# Exemple : forcer l'écoute sur l'IP locale affichée par Windows ou changer de port
HOST=192.168.1.85 PORT=3327 npm run dev
```

> ℹ️ Pensez à configurer la redirection de port (NAT/PAT) sur le routeur Freebox vers l'adresse IP locale de
> la machine (ex. `192.168.1.85:3327`) et à autoriser les connexions entrantes dans le pare-feu Windows.
> Vous pourrez ensuite appeler l'API depuis Internet via `http://82.65.248.149:3327`.