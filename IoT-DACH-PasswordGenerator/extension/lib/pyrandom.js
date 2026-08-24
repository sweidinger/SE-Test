/**
 * Bit-genauer Nachbau von CPythons `random`-Modul, soweit die Passwortableitung
 * es benoetigt: seed(int), randint(a, b), choice(seq).
 *
 * WARUM DAS EXAKT SEIN MUSS
 * -------------------------
 * generate_password() streut Sonderzeichen an Positionen ein, die aus einem mit
 * dem SHA-256-Hash geseedeten Mersenne Twister stammen. Weicht hier auch nur ein
 * Bit ab, entstehen andere Passwoerter -- und damit waeren alle bereits
 * ausgerollten Geraete nicht mehr erreichbar.
 *
 * Referenz: CPython Modules/_randommodule.c (init_by_array, genrand_uint32,
 * getrandbits) und Lib/random.py (_randbelow_with_getrandbits, randrange,
 * choice). Der Algorithmus ist zwischen CPython 3.9 und 3.14 unveraendert.
 *
 * Abgesichert durch test/vectors.json (3005 Vektoren aus dem Originaltool),
 * ausgefuehrt von test/run-tests.mjs.
 */

const N = 624;
const M = 397;
const MATRIX_A = 0x9908b0df;
const UPPER_MASK = 0x80000000;
const LOWER_MASK = 0x7fffffff;

class MersenneTwister {
  constructor() {
    this.mt = new Uint32Array(N);
    this.mti = N + 1;
  }

  /** CPython init_genrand() */
  initGenrand(s) {
    this.mt[0] = s >>> 0;
    for (let i = 1; i < N; i++) {
      const prev = this.mt[i - 1] ^ (this.mt[i - 1] >>> 30);
      this.mt[i] = (Math.imul(1812433253, prev) + i) >>> 0;
    }
    this.mti = N;
  }

  /** CPython init_by_array() -- so seedet random.seed(int) */
  initByArray(key) {
    this.initGenrand(19650218);
    let i = 1;
    let j = 0;
    let k = Math.max(N, key.length);
    for (; k; k--) {
      const prev = this.mt[i - 1] ^ (this.mt[i - 1] >>> 30);
      this.mt[i] = (((this.mt[i] ^ Math.imul(prev, 1664525)) >>> 0) + key[j] + j) >>> 0;
      i++; j++;
      if (i >= N) { this.mt[0] = this.mt[N - 1]; i = 1; }
      if (j >= key.length) j = 0;
    }
    for (k = N - 1; k; k--) {
      const prev = this.mt[i - 1] ^ (this.mt[i - 1] >>> 30);
      this.mt[i] = (((this.mt[i] ^ Math.imul(prev, 1566083941)) >>> 0) - i) >>> 0;
      i++;
      if (i >= N) { this.mt[0] = this.mt[N - 1]; i = 1; }
    }
    this.mt[0] = 0x80000000;
  }

  /** CPython genrand_uint32() inklusive Tempering */
  genrandUint32() {
    let y;
    if (this.mti >= N) {
      let kk;
      for (kk = 0; kk < N - M; kk++) {
        y = ((this.mt[kk] & UPPER_MASK) | (this.mt[kk + 1] & LOWER_MASK)) >>> 0;
        this.mt[kk] = (this.mt[kk + M] ^ (y >>> 1) ^ (y & 1 ? MATRIX_A : 0)) >>> 0;
      }
      for (; kk < N - 1; kk++) {
        y = ((this.mt[kk] & UPPER_MASK) | (this.mt[kk + 1] & LOWER_MASK)) >>> 0;
        this.mt[kk] = (this.mt[kk + (M - N)] ^ (y >>> 1) ^ (y & 1 ? MATRIX_A : 0)) >>> 0;
      }
      y = ((this.mt[N - 1] & UPPER_MASK) | (this.mt[0] & LOWER_MASK)) >>> 0;
      this.mt[N - 1] = (this.mt[M - 1] ^ (y >>> 1) ^ (y & 1 ? MATRIX_A : 0)) >>> 0;
      this.mti = 0;
    }
    y = this.mt[this.mti++];
    y = (y ^ (y >>> 11)) >>> 0;
    y = (y ^ ((y << 7) & 0x9d2c5680)) >>> 0;
    y = (y ^ ((y << 15) & 0xefc60000)) >>> 0;
    y = (y ^ (y >>> 18)) >>> 0;
    return y >>> 0;
  }
}

/**
 * CPython random_seed(): abs(n) wird in 32-Bit-Woerter zerlegt, little endian.
 */
function seedKeyFromBigInt(n) {
  let v = n < 0n ? -n : n;
  if (v === 0n) return [0];
  const key = [];
  while (v > 0n) {
    key.push(Number(v & 0xffffffffn));
    v >>= 32n;
  }
  return key;
}

export class PyRandom {
  /** @param {bigint} seed entspricht random.seed(seed) */
  constructor(seed) {
    this.mt = new MersenneTwister();
    this.mt.initByArray(seedKeyFromBigInt(seed));
  }

  /**
   * CPython getrandbits(). Nur der Pfad k <= 32 ist implementiert; das genuegt,
   * solange _randbelow nur mit n <= 2**32 aufgerufen wird (hier: Passwortlaenge
   * und Alphabetgroessen). Groessere k wuerden still falsche Werte liefern,
   * deshalb ein harter Fehler statt einer stillen Abweichung.
   */
  getrandbits(k) {
    if (k === 0) return 0;
    if (k > 32) throw new RangeError(`getrandbits(${k}): nur k <= 32 implementiert`);
    return this.mt.genrandUint32() >>> (32 - k);
  }

  /** CPython _randbelow_with_getrandbits(): Rejection Sampling ueber n.bit_length() */
  _randbelow(n) {
    if (!n) return 0;
    const k = 32 - Math.clz32(n); // entspricht n.bit_length()
    let r = this.getrandbits(k);
    while (r >= n) r = this.getrandbits(k);
    return r;
  }

  /** CPython randint(a, b) == randrange(a, b+1) == a + _randbelow(b+1-a) */
  randint(a, b) {
    return a + this._randbelow(b + 1 - a);
  }

  /** CPython choice(seq) == seq[_randbelow(len(seq))] */
  choice(seq) {
    return seq[this._randbelow(seq.length)];
  }
}
