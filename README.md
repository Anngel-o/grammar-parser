# Grammar Parser

Herramienta web para compilar gramáticas formales en notación BNF y verificar si una palabra pertenece al lenguaje definido.

Desarrollada como proyecto para la materia de **Teoría de la Computación**. Es una adaptación en JavaScript de un lexer/parser originalmente escrito en Python — la versión original leía archivos de texto desde disco y generaba código Python; esta versión corre completamente en el navegador sin necesidad de servidor.

## ¿Cómo funciona?

1. El usuario escribe una gramática BNF directamente en la interfaz
2. El **lexer** la tokeniza mediante un autómata finito con matriz de transiciones de estados
3. El **parser** realiza el análisis sintáctico por descenso recursivo
4. Se producen dos resultados en simultáneo:
   - El código Python equivalente del parser, visible en pantalla y listo para copiar
   - Una estructura interna de reglas que un intérprete JavaScript usa para verificar palabras contra la gramática en tiempo real
     

## Demo

🔗 [anngel-o.github.io/grammar-parser](https://anngel-o.github.io/grammar-parser/)

<img width="946" height="416" alt="image" src="https://github.com/user-attachments/assets/085c2c25-491c-40f4-88e6-f562e38e3d0a" />
<img width="941" height="392" alt="image" src="https://github.com/user-attachments/assets/2119951b-93f9-442f-97ea-a31e1e9041b6" />

