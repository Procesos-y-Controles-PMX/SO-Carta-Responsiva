-- Cartas: keep only the platform owner as administrador general.
-- Other allowlisted accounts drop one tier to administrador de zona.
-- Region is left as-is (assign one in Usuarios if it is still empty).

update cr_usuarios
set rol = 'administrador_zona'
where lower(email) in (
  'isabela.guzmana@cemex.com',
  'danielalejandro.esparza@cemex.com'
)
  and rol = 'administrador_general';
