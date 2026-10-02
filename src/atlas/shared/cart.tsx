import { useState } from "react";
import { ShoppingBag, CheckCircle2, Minus, Plus, Trash2 } from "lucide-react";
import type { Entity } from "../types";
import { money } from "../types";
import { Modal, Button, Photo, Empty, Badge, useToast } from "./ui";
export function useCart() {
  const [cart, setCart] = useState<(Entity & { quantity: number })[]>([]);
  return {
    cart,
    setCart,
    add: (item: Entity) =>
      setCart((p) =>
        p.some((x) => x.id === item.id)
          ? p.map((x) =>
              x.id === item.id
                ? { ...x, quantity: Math.min(99, x.quantity + 1) }
                : x,
            )
          : [...p, { ...item, quantity: 1 }],
      ),
    count: cart.reduce((s, p) => s + p.quantity, 0),
  };
}
export function CartModal({
  open,
  onClose,
  cart,
  setCart,
  delivery = false,
}: {
  open: boolean;
  onClose: () => void;
  cart: (Entity & { quantity: number })[];
  setCart: React.Dispatch<
    React.SetStateAction<(Entity & { quantity: number })[]>
  >;
  delivery?: boolean;
}) {
  const [done, setDone] = useState(false),
    [method, setMethod] = useState("Retirada");
  const [checkout, setCheckout] = useState(false);
  const total =
    cart.reduce((s, i) => s + (i.price || 0) * i.quantity, 0) +
    (delivery && method === "Entrega" && cart.length ? 8 : 0);
  return (
    <Modal
      open={open}
      onClose={() => {
        onClose();
        setDone(false);
        setCheckout(false);
      }}
      title={
        done
          ? "Pedido de exemplo"
          : checkout
            ? "Finalizar demonstração"
            : "Seu carrinho"
      }
    >
      {done ? (
        <div className="success-card">
          <CheckCircle2 size={50} />
          <h2>Experiência concluída.</h2>
          <p>
            Seu pedido foi simulado com sucesso. Nenhuma compra, cobrança ou
            entrega real foi feita.
          </p>
          <Button
            onClick={() => {
              setDone(false);
              setCheckout(false);
              onClose();
            }}
          >
            Continuar explorando
          </Button>
        </div>
      ) : !cart.length ? (
        <Empty
          title="Seu carrinho está esperando"
          text="Escolha um item para experimentar a compra."
        />
      ) : checkout ? (
        <form
          className="form-stack"
          onSubmit={(e) => {
            e.preventDefault();
            setDone(true);
            setCart([]);
          }}
        >
          <Badge>Demonstração · sem pagamento real</Badge>
          <label className="field">
            <span>Nome de exemplo</span>
            <input required placeholder="Seu nome" />
          </label>
          <label className="field">
            <span>E-mail</span>
            <input type="email" required placeholder="voce@exemplo.com" />
          </label>
          {(!delivery || method === "Entrega") && (
            <label className="field">
              <span>Endereço de exemplo</span>
              <input required placeholder="Rua, número, cidade" />
            </label>
          )}
          <div className="between">
            <b>Total</b>
            <b>{money(total)}</b>
          </div>
          <Button type="submit">Simular pedido</Button>
          <Button
            variant="ghost"
            type="button"
            onClick={() => setCheckout(false)}
          >
            Revisar carrinho
          </Button>
        </form>
      ) : (
        <>
          <div>
            {cart.map((i) => (
              <div className="cart-row" key={i.id}>
                {i.image ? (
                  <Photo name={i.image} alt={i.title} />
                ) : (
                  <span className="big-icon">
                    <ShoppingBag size={22} />
                  </span>
                )}
                <div>
                  <h3>{i.title}</h3>
                  <p>{money(i.price || 0)}</p>
                  <div className="qty">
                    <button
                      aria-label={`Diminuir ${i.title}`}
                      onClick={() =>
                        setCart((p) =>
                          p
                            .map((x) =>
                              x.id === i.id
                                ? { ...x, quantity: x.quantity - 1 }
                                : x,
                            )
                            .filter((x) => x.quantity > 0),
                        )
                      }
                    >
                      −
                    </button>
                    <span>{i.quantity}</span>
                    <button
                      aria-label={`Aumentar ${i.title}`}
                      disabled={i.quantity >= 99}
                      onClick={() =>
                        setCart((p) =>
                          p.map((x) =>
                            x.id === i.id
                              ? { ...x, quantity: x.quantity + 1 }
                              : x,
                          ),
                        )
                      }
                    >
                      +
                    </button>
                  </div>
                </div>
                <button
                  className="icon-button"
                  aria-label={`Remover ${i.title}`}
                  onClick={() => setCart((p) => p.filter((x) => x.id !== i.id))}
                >
                  <Trash2 size={15} />
                </button>
              </div>
            ))}
          </div>
          {delivery && (
            <label className="field" style={{ marginTop: 24 }}>
              <span>Como prefere receber?</span>
              <select
                value={method}
                onChange={(e) => setMethod(e.target.value)}
              >
                <option>Retirada</option>
                <option>Entrega</option>
              </select>
              <small className="field-hint">
                Entrega demonstrativa: R$ 8,00 · Retirada: grátis
              </small>
            </label>
          )}
          <div className="between" style={{ margin: "25px 0" }}>
            <b>Total</b>
            <strong style={{ fontSize: 24 }}>{money(total)}</strong>
          </div>
          <Button className="full" onClick={() => setCheckout(true)}>
            Continuar para o pedido
          </Button>
          <p className="field-hint">
            Carrinho de demonstração. Sem cobrança ou reserva de estoque.
          </p>
        </>
      )}
    </Modal>
  );
}
