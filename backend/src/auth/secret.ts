import dotenv from 'dotenv';

dotenv.config();

// Aucune valeur par defaut. Un secret de repli est pire qu'une absence de secret :
// il fonctionne, donc personne ne le remarque, et les jetons de production sont
// signes avec une valeur qui traine dans le depot. On refuse de demarrer.
const secret = process.env.JWT_SECRET;

if (!secret || secret.length < 32) {
  throw new Error(
    'JWT_SECRET absent ou trop court (32 caracteres minimum). ' +
      'Generer : node -e "console.log(require(\'crypto\').randomBytes(32).toString(\'hex\'))"'
  );
}

export const JWT_SECRET: string = secret;

// Duree de vie du jeton. Une session de phoning dure une journee : au-dela, le
// chef de table se reconnecte. En dessous, il se fait deconnecter en pleine
// saisie, ce qui est exactement la friction que le module C doit eviter.
export const JWT_EXPIRES_IN = '12h';
