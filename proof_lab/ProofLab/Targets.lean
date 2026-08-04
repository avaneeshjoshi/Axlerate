import Mathlib

namespace ProofLab

theorem target_nat_add_zero (n : Nat) : n + 0 = n := by
  rfl

theorem target_nat_zero_add (n : Nat) : 0 + n = n := by
  simp

theorem target_set_inter_comm {alpha : Type} (A B : Set alpha) :
    Set.inter A B = Set.inter B A := by
  exact Set.inter_comm A B

theorem target_set_union_comm {alpha : Type} (A B : Set alpha) :
    Set.union A B = Set.union B A := by
  exact Set.union_comm A B

theorem target_nat_add_comm (m n : Nat) : m + n = n + m := by
  omega

theorem target_set_union_assoc {alpha : Type} (A B C : Set alpha) :
    Set.union (Set.union A B) C = Set.union A (Set.union B C) := by
  exact Set.union_assoc A B C

end ProofLab
